'use strict';

const express = require('express');

const Product = require('../models/Product');
const User = require('../models/User');
const { authenticate, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recommendForUser } = require('../services/recommendationService');

const router = express.Router();

const MAX_VIEWED = 50; // historial de vistas que guardamos por usuario

/** Registra que un usuario vio un producto (más reciente primero, sin duplicados). */
const recordView = async (userId, productId) => {
  await User.updateOne({ _id: userId }, { $pull: { viewedProductIds: productId } });
  await User.updateOne(
    { _id: userId },
    { $push: { viewedProductIds: { $each: [productId], $position: 0, $slice: MAX_VIEWED } } }
  );
};

// GET /api/products  — listado con filtros (category, search, sort, minPrice, maxPrice)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, search, sort, minPrice, maxPrice } = req.query;

    const docs = await Product.find();
    let products = docs.map((d) => d.toJSON()); // incluye finalPrice

    if (category) {
      products = products.filter(
        (p) => p.category.toLowerCase() === String(category).toLowerCase()
      );
    }

    if (search) {
      const q = String(search).toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // El filtro de precio se aplica sobre el precio FINAL (con descuento).
    if (minPrice !== undefined) products = products.filter((p) => p.finalPrice >= Number(minPrice));
    if (maxPrice !== undefined) products = products.filter((p) => p.finalPrice <= Number(maxPrice));

    if (sort === 'price_asc') products.sort((a, b) => a.finalPrice - b.finalPrice);
    else if (sort === 'price_desc') products.sort((a, b) => b.finalPrice - a.finalPrice);
    else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);

    res.json(products);
  })
);

// GET /api/products/categories  (debe ir antes de /:id)
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await Product.distinct('category');
    res.json(categories);
  })
);

// GET /api/products/offers  — carrusel promocional (descuento > 0)
router.get(
  '/offers',
  asyncHandler(async (_req, res) => {
    const docs = await Product.find({ discount: { $gt: 0 } });
    const offers = docs.map((d) => d.toJSON()).sort((a, b) => b.discount - a.discount);
    res.json(offers);
  })
);

// GET /api/products/recommendations  — personalizadas (requiere login)
router.get(
  '/recommendations',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    res.json(await recommendForUser(req.user.id, limit));
  })
);

// GET /api/products/:id  — detalle (registra la vista si hay sesión)
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Producto no encontrado');

    if (req.user) await recordView(req.user.id, product._id);
    res.json(product.toJSON());
  })
);

// POST /api/products/:id/view  — registrar vista explícitamente
router.post(
  '/:id/view',
  authenticate,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Producto no encontrado');

    await recordView(req.user.id, product._id);
    res.json({ message: 'Vista registrada' });
  })
);

module.exports = router;
