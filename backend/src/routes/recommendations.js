'use strict';

const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const Order = require('../models/Order');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/recommendations
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    // Sin usuario: top productos por rating * ratingCount
    if (!req.user) {
      const products = await Product.find({ stock: { $gt: 0 } }).lean();
      const scored = products
        .map((p) => ({ ...p, score: p.rating * (p.ratingCount || 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      return res.json(scored.map(({ score, ...p }) => ({ ...p, id: p._id, finalPrice: Math.round(p.price * (1 - (p.discount || 0) / 100) * 100) / 100 })));
    }

    // Con usuario: filtrado colaborativo simple
    const myOrders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(10).lean();
    const myProductIds = new Set(myOrders.flatMap((o) => o.items.map((i) => i.productId)));

    if (myProductIds.size === 0) {
      // Sin historial → top por rating
      const products = await Product.find({ stock: { $gt: 0 } }).sort({ rating: -1 }).limit(8).lean();
      return res.json(products.map((p) => ({ ...p, id: p._id, finalPrice: Math.round(p.price * (1 - (p.discount || 0) / 100) * 100) / 100 })));
    }

    // Buscar pedidos de otros usuarios que compraron mis productos
    const similarOrders = await Order.find({
      userId: { $ne: req.user.id },
      'items.productId': { $in: [...myProductIds] },
    }).limit(50).lean();

    // Contar frecuencia de co-ocurrencia
    const freq = new Map();
    similarOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!myProductIds.has(item.productId)) {
          freq.set(item.productId, (freq.get(item.productId) || 0) + 1);
        }
      });
    });

    if (freq.size === 0) {
      // No hay co-ocurrencias → top por rating excluyendo ya comprados
      const products = await Product.find({
        _id: { $nin: [...myProductIds] },
        stock: { $gt: 0 },
      }).sort({ rating: -1 }).limit(8).lean();
      return res.json(products.map((p) => ({ ...p, id: p._id, finalPrice: Math.round(p.price * (1 - (p.discount || 0) / 100) * 100) / 100 })));
    }

    // Ordenar por frecuencia y traer los top 8
    const sortedIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
    const products = await Product.find({ _id: { $in: sortedIds }, stock: { $gt: 0 } }).lean();

    // Mantener el orden por frecuencia
    const byId = new Map(products.map((p) => [p._id, p]));
    const result = sortedIds.map((id) => byId.get(id)).filter(Boolean).map((p) => ({
      ...p, id: p._id,
      finalPrice: Math.round(p.price * (1 - (p.discount || 0) / 100) * 100) / 100,
    }));

    res.json(result);
  })
);

module.exports = router;
