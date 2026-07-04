'use strict';

const express = require('express');

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields } = require('../utils/validators');
const { finalPrice, buildTotals } = require('../utils/pricing');
const { validateCoupon } = require('../services/couponService');
const { streamReceipt } = require('../services/pdfService');
const stockEmitter = require('../services/stockEmitter');

const router = express.Router();

const PAYMENT_METHODS = ['card', 'cash_on_delivery'];
const DELIVERY_TYPES = ['delivery', 'pickup'];

// POST /api/orders/checkout
router.post(
  '/checkout',
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      paymentMethod = 'card',
      deliveryType = 'delivery',
      shippingAddress,
      pickupCenter,
      couponCode,
    } = req.body;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw ApiError.badRequest(`Método de pago inválido. Use: ${PAYMENT_METHODS.join(', ')}`);
    }
    if (!DELIVERY_TYPES.includes(deliveryType)) {
      throw ApiError.badRequest(`Tipo de entrega inválido. Use: ${DELIVERY_TYPES.join(', ')}`);
    }
    if (deliveryType === 'delivery') requireFields(req.body, ['shippingAddress']);
    if (deliveryType === 'pickup') requireFields(req.body, ['pickupCenter']);

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) throw ApiError.badRequest('El carrito está vacío');

    const ids = cart.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids } });
    const byId = new Map(products.map((p) => [p._id, p]));

    // Construir ítems validando stock.
    const orderItems = cart.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw ApiError.badRequest(`Producto no disponible: ${item.productId}`);
      if (product.stock < item.quantity) {
        throw ApiError.badRequest(`Stock insuficiente para "${product.name}"`);
      }
      const unitPrice = finalPrice(product);
      return {
        productId: product._id,
        name: product.name,
        price: product.price,
        discount: product.discount || 0,
        finalPrice: unitPrice,
        quantity: item.quantity,
        image: product.image,
        subtotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    // Totales (descuentos de producto + cupón + envío).
    const baseTotals = buildTotals(orderItems, { deliveryType });
    let coupon = null;
    if (couponCode) {
      const validated = await validateCoupon(couponCode, baseTotals.subtotal);
      coupon = validated.coupon;
    }
    const totals = buildTotals(orderItems, { coupon, deliveryType });

    const now = new Date();
    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      subtotal: totals.subtotal,
      productDiscount: totals.productDiscount,
      couponCode: coupon ? coupon.code : null,
      couponDiscount: totals.couponDiscount,
      shipping: totals.shipping,
      total: totals.total,
      paymentMethod,
      deliveryType,
      shippingAddress: deliveryType === 'delivery' ? shippingAddress : null,
      pickupCenter: deliveryType === 'pickup' ? pickupCenter : null,
      status: 'preparing',
      statusHistory: [{ status: 'preparing', at: now }],
      rated: false,
    });

    // Descontar stock, emitir eventos de stock y vaciar carrito.
    await Promise.all(
      orderItems.map(async (item) => {
        const updated = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (updated) stockEmitter.emit('stock_update', { productId: item.productId, stock: updated.stock });
      })
    );
    cart.items = [];
    await cart.save();

    // Sumar puntos al usuario (10 puntos por cada sol gastado).
    const earnedPoints = Math.floor(order.total * 10);
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { points: earnedPoints },
      $push: {
        pointsHistory: {
          amount: earnedPoints,
          reason: `Compra #${order._id.toString().slice(-6)}`,
          createdAt: new Date(),
        },
      },
    });

    res.status(201).json(order.toJSON());
  })
);

// GET /api/orders  — historial del usuario
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders.map((o) => o.toJSON()));
  })
);

// GET /api/orders/:id
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    res.json(order.toJSON());
  })
);

// POST /api/orders/:id/complaint
router.post(
  '/:id/complaint',
  authenticate,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) throw ApiError.badRequest('El texto del reclamo es requerido');
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    if (order.complaint) throw ApiError.badRequest('Ya existe un reclamo para este pedido');
    const now = new Date();
    order.complaint = {
      text: text.trim(),
      status: 'pending',
      submittedAt: now,
      messages: [{ sender: 'user', text: text.trim(), sentAt: now }],
    };
    await order.save();
    res.status(201).json(order.toJSON());
  })
);

// POST /api/orders/:id/complaint/message
router.post(
  '/:id/complaint/message',
  authenticate,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) throw ApiError.badRequest('El mensaje no puede estar vacío');
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    if (!order.complaint) throw ApiError.badRequest('Este pedido no tiene un reclamo abierto');
    if (order.complaint.status !== 'pending') throw ApiError.badRequest('El reclamo ya fue resuelto');
    order.complaint.messages.push({ sender: 'user', text: text.trim(), sentAt: new Date() });
    await order.save();
    res.json(order.toJSON());
  })
);

// GET /api/orders/:id/receipt  — boleta PDF
router.get(
  '/:id/receipt',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    const user = await User.findById(req.user.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boleta-${order.id}.pdf"`);
    streamReceipt(order.toJSON(), user ? user.toJSON() : {}, res);
  })
);

module.exports = router;