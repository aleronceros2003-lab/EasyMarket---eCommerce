'use strict';

const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const router = express.Router();

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
          { $match: { status: 'delivered' } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        Order.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name email'),
      ]);

    const totalRevenue = revenueAgg[0]?.total ?? 0;
    const ordersByStatus = { preparing: 0, on_the_way: 0, delivered: 0 };
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
      { $match: { status: 'delivered', createdAt: { $gte: sevenDaysAgo } } },
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
    const FLOW = ['preparing', 'on_the_way', 'delivered'];
    if (!FLOW.includes(status)) throw ApiError.badRequest('Estado inválido');
    const order = await Order.findById(req.params.id).populate('userId', 'pushToken name');
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    order.status = status;
    order.statusHistory.push({ status, at: new Date() });
    await order.save();

    // Push notification
    const { sendPushNotification } = require('../services/pushService');
    const messages = {
      on_the_way: { title: '🚴 Tu pedido está en camino', body: 'El repartidor ya salió con tu pedido.' },
      delivered: { title: '✅ Pedido entregado', body: '¡Tu pedido llegó! No olvides calificarlo.' },
    };
    if (messages[status] && order.userId?.pushToken) {
      sendPushNotification(order.userId.pushToken, messages[status].title, messages[status].body, { orderId: order.id });
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
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) throw ApiError.notFound('Producto no encontrado');
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

module.exports = router;
