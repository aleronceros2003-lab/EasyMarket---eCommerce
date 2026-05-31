'use strict';

const express = require('express');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

const inRange = (v) => Number.isFinite(v) && v >= 1 && v <= 5;

// POST /api/reviews  — valorar un pedido entregado (producto + servicio + entrega)
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { orderId, appRating, deliveryRating, comment, products = [] } = req.body;

    if (!orderId) throw ApiError.badRequest('orderId es obligatorio');
    if (!inRange(Number(appRating))) throw ApiError.badRequest('appRating debe estar entre 1 y 5');
    if (!inRange(Number(deliveryRating))) {
      throw ApiError.badRequest('deliveryRating debe estar entre 1 y 5');
    }

    const order = await Order.findOne({ _id: orderId, userId: req.user.id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    if (order.status !== 'delivered') {
      throw ApiError.badRequest('Solo puedes valorar pedidos entregados');
    }
    if (order.rated) throw ApiError.conflict('Este pedido ya fue valorado');

    // Validar que los productos valorados pertenezcan al pedido.
    const orderProductIds = new Set(order.items.map((i) => i.productId));
    for (const pr of products) {
      if (!orderProductIds.has(pr.productId)) {
        throw ApiError.badRequest(`El producto ${pr.productId} no pertenece al pedido`);
      }
      if (!inRange(Number(pr.rating))) {
        throw ApiError.badRequest(`Valoración inválida para ${pr.productId} (1 a 5)`);
      }
    }

    const review = await Review.create({
      orderId,
      userId: req.user.id,
      appRating: Number(appRating),
      deliveryRating: Number(deliveryRating),
      comment: comment || '',
      products: products.map((p) => ({ productId: p.productId, rating: Number(p.rating) })),
    });

    // Recalcular el rating promedio de cada producto valorado.
    await Promise.all(
      review.products.map(async (pr) => {
        const product = await Product.findById(pr.productId);
        if (!product) return;
        const count = product.ratingCount || 0;
        const avg = product.rating || 0;
        const newCount = count + 1;
        product.rating = Math.round(((avg * count + pr.rating) / newCount) * 10) / 10;
        product.ratingCount = newCount;
        await product.save();
      })
    );

    // Marcar el pedido como valorado.
    order.rated = true;
    await order.save();

    res.status(201).json(review.toJSON());
  })
);

// GET /api/reviews/product/:productId
router.get(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const reviews = await Review.find({ 'products.productId': productId }).lean();
    const result = reviews.map((r) => {
      const pr = r.products.find((p) => p.productId === productId);
      return { rating: pr.rating, comment: r.comment, createdAt: r.createdAt };
    });
    res.json(result);
  })
);

module.exports = router;
