'use strict';

const express = require('express');

const Coupon = require('../models/Coupon');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { validateCoupon } = require('../services/couponService');

const router = express.Router();

// GET /api/coupons  — cupones activos (sin exponer datos internos)
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const coupons = await Coupon.find({ active: true }).lean();
    res.json(
      coupons.map(({ code, type, value, minPurchase }) => ({ code, type, value, minPurchase }))
    );
  })
);

// POST /api/coupons/validate
router.post(
  '/validate',
  authenticate,
  asyncHandler(async (req, res) => {
    const { code, subtotal } = req.body;
    const { coupon, discount } = await validateCoupon(code, Number(subtotal) || 0);
    res.json({ valid: true, code: coupon.code, type: coupon.type, value: coupon.value, discount });
  })
);

module.exports = router;
