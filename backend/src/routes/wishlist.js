'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/wishlist
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).lean();
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const products = await Product.find({ _id: { $in: user.wishlist } }).lean();
    res.json(products.map((p) => ({
      ...p, id: p._id,
      finalPrice: Math.round(p.price * (1 - (p.discount || 0) / 100) * 100) / 100,
    })));
  })
);

// POST /api/wishlist/:productId
router.post(
  '/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Producto no encontrado');
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { wishlist: productId } },
      { new: true }
    ).lean();
    res.json({ wishlist: user.wishlist });
  })
);

// DELETE /api/wishlist/:productId
router.delete(
  '/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { wishlist: req.params.productId } },
      { new: true }
    ).lean();
    res.json({ wishlist: user.wishlist });
  })
);

module.exports = router;
