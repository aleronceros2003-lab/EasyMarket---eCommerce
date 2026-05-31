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

const router = express.Router();

const PAYMENT_METHODS = ['card', 'cash_on_delivery'];
const DELIVERY_TYPES = ['delivery', 'pickup'];
const ORDER_FLOW = ['preparing', 'on_the_way', 'delivered'];

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

    // Descontar stock y vaciar carrito.
    await Promise.all(
      orderItems.map((item) =>
        Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } })
      )
    );
    cart.items = [];
    await cart.save();

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

// PATCH /api/orders/:id/status  (en producción: endpoint de administración)
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!ORDER_FLOW.includes(status)) {
      throw ApiError.badRequest(`Estado inválido. Use: ${ORDER_FLOW.join(', ')}`);
    }

    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');

    // Solo avanzar, nunca retroceder.
    if (ORDER_FLOW.indexOf(status) < ORDER_FLOW.indexOf(order.status)) {
      throw ApiError.badRequest('No se puede retroceder el estado del pedido');
    }
    order.status = status;
    order.statusHistory.push({ status, at: new Date() });
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
