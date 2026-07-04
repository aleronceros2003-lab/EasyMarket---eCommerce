'use strict';

const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { sendWishlistOfferEmail, sendOrderStatusEmail } = require('../services/emailService');
const { sendPushNotification } = require('../services/pushService');

const router = express.Router();

const DELIVERY_FLOW = ['preparing', 'on_the_way', 'at_door', 'delivered', 'finalized'];

// GET /api/admin/stats
router.get(
  '/stats',
  adminAuth,
  asyncHandler(async (_req, res) => {
    const [totalUsers, totalOrders, totalProducts, revenueAgg, statusAgg, recentOrders] =
      await Promise.all([
        User.countDocuments(),
        Order.countDocuments(),
        Product.countDocuments(),
        Order.aggregate([
          { $match: { status: { $in: ['delivered', 'finalized'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        Order.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name email'),
      ]);

    const totalRevenue = revenueAgg[0]?.total ?? 0;
    const ordersByStatus = { preparing: 0, on_the_way: 0, at_door: 0, delivered: 0, finalized: 0 };
    statusAgg.forEach(({ _id, count }) => { ordersByStatus[_id] = count; });

    // Top 5 productos más vendidos
    const topProductsAgg = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' }, name: { $first: '$items.name' }, image: { $first: '$items.image' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);

    // Revenue últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const revenueByDayAgg = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'finalized'] }, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const revenueByDay = revenueByDayAgg.map((r) => ({ date: r._id, revenue: r.revenue }));

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProducts,
      ordersByStatus,
      recentOrders: recentOrders.map((o) => o.toJSON()),
      topProducts: topProductsAgg,
      revenueByDay,
    });
  })
);

// GET /api/admin/orders
router.get(
  '/orders',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('userId', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ orders: orders.map((o) => o.toJSON()), total, page: Number(page), limit: Number(limit) });
  })
);

// PATCH /api/admin/orders/:id/status
router.patch(
  '/orders/:id/status',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!DELIVERY_FLOW.includes(status)) {
      throw ApiError.badRequest(`Estado inválido. Use: ${DELIVERY_FLOW.join(', ')}`);
    }
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Pedido no encontrado');

    // FINALIZADO puede aplicarse desde cualquier estado; el resto debe avanzar secuencialmente.
    if (status !== 'finalized') {
      const currentIdx = DELIVERY_FLOW.indexOf(order.status);
      const targetIdx = DELIVERY_FLOW.indexOf(status);
      if (targetIdx <= currentIdx) throw ApiError.badRequest('No se puede retroceder el estado del pedido');
    }

    order.status = status;
    order.statusHistory.push({ status, at: new Date() });
    await order.save();

    // Push + email al usuario (fire-and-forget)
    const pushMessages = {
      on_the_way: { title: '🚴 Tu pedido está en camino', body: 'El repartidor ya salió con tu pedido.' },
      at_door: { title: '🏠 El repartidor está en tu puerta', body: 'Tu pedido está siendo entregado ahora mismo.' },
      delivered: { title: '📦 Pedido entregado por el repartidor', body: 'El repartidor confirmó la entrega de tu pedido.' },
      finalized: { title: '✅ Tu pedido fue finalizado', body: '¡Ya puedes confirmar la entrega y calificarnos!' },
    };

    const notifyStatuses = ['on_the_way', 'at_door', 'delivered', 'finalized'];
    if (notifyStatuses.includes(status)) {
      User.findById(order.userId).select('pushToken email name').then((user) => {
        if (!user) return;
        if (user.pushToken && pushMessages[status]) {
          sendPushNotification(user.pushToken, pushMessages[status].title, pushMessages[status].body, { orderId: order.id });
        }
        sendOrderStatusEmail(user.toJSON(), order.toJSON(), status).catch(() => {});
      }).catch(() => {});
    }

    res.json(order.toJSON());
  })
);

// GET /api/admin/users
router.get(
  '/users',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(),
    ]);
    res.json({ users: users.map((u) => u.toJSON()), total, page: Number(page), limit: Number(limit) });
  })
);

// PATCH /api/admin/users/:id/role
router.patch(
  '/users/:id/role',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) throw ApiError.badRequest('Rol inválido');
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    res.json(user.toJSON());
  })
);

// GET /api/admin/products
router.get(
  '/products',
  adminAuth,
  asyncHandler(async (_req, res) => {
    const products = await Product.find().sort({ category: 1, name: 1 });
    res.json(products.map((p) => p.toJSON()));
  })
);

// POST /api/admin/products
router.post(
  '/products',
  adminAuth,
  asyncHandler(async (req, res) => {
    const product = await Product.create(req.body);
    res.status(201).json(product.toJSON());
  })
);

// PUT /api/admin/products/:id
router.put(
  '/products/:id',
  adminAuth,
  asyncHandler(async (req, res) => {
    const existing = await Product.findById(req.params.id);
    if (!existing) throw ApiError.notFound('Producto no encontrado');

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    // Si el descuento subió (o es nuevo), notificar por email a usuarios que lo tienen en favoritos
    const prevDiscount = existing.discount || 0;
    const newDiscount = Number(req.body.discount) || 0;
    if (newDiscount > 0 && newDiscount > prevDiscount) {
      const wishlistUsers = await User.find({
        wishlist: product._id.toString(),
        emailAlerts: true,
      }).lean();
      if (wishlistUsers.length > 0) {
        Promise.allSettled(wishlistUsers.map((u) => sendWishlistOfferEmail(u, product))).catch(() => {});
      }
    }

    res.json(product.toJSON());
  })
);

// DELETE /api/admin/products/:id
router.delete(
  '/products/:id',
  adminAuth,
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw ApiError.notFound('Producto no encontrado');
    res.json({ message: 'Producto eliminado' });
  })
);

// ─── Reclamos ─────────────────────────────────────────────────────────────────

// GET /api/admin/complaints?status=pending&page=1
router.get(
  '/complaints',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const filter = { complaint: { $ne: null } };
    if (status) filter['complaint.status'] = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ 'complaint.submittedAt': -1 }).skip(skip).limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    // Enriquecer con datos del usuario (userId es String, no ObjectId)
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const result = orders.map((o) => ({
      ...o.toJSON(),
      user: userMap.get(o.userId) || null,
    }));

    res.json({ orders: result, total, page: Number(page), limit: Number(limit) });
  })
);

// POST /api/admin/complaints/:orderId/message
router.post(
  '/complaints/:orderId/message',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) throw ApiError.badRequest('El mensaje no puede estar vacío');
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    if (!order.complaint) throw ApiError.badRequest('Este pedido no tiene un reclamo');
    order.complaint.messages.push({ sender: 'admin', text: text.trim(), sentAt: new Date() });
    await order.save();

    // Notificar al usuario por push
    const user = await User.findById(order.userId).select('pushToken');
    if (user?.pushToken) {
      sendPushNotification(user.pushToken, '💬 El equipo de EasyMarket respondió', text.trim().slice(0, 80), { orderId: order.id });
    }

    res.json(order.toJSON());
  })
);

// PATCH /api/admin/complaints/:orderId
router.patch(
  '/complaints/:orderId',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['valid', 'invalid'].includes(status)) {
      throw ApiError.badRequest('Estado inválido. Use: valid, invalid');
    }
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    if (!order.complaint) throw ApiError.badRequest('Este pedido no tiene un reclamo');

    order.complaint.status = status;
    order.complaint.resolvedAt = new Date();
    await order.save();

    res.json(order.toJSON());
  })
);

module.exports = router;
