'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const router = express.Router();

const POINTS_PER_SOL = 10;      // 10 puntos por cada sol gastado
const POINTS_PER_DISCOUNT = 100; // 100 puntos = S/ 1.00

// GET /api/points
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('points pointsHistory').lean();
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    res.json({ points: user.points, history: user.pointsHistory });
  })
);

// POST /api/points/redeem
router.post(
  '/redeem',
  authenticate,
  asyncHandler(async (req, res) => {
    const { points } = req.body;
    const amount = Number(points);

    if (!amount || amount < POINTS_PER_DISCOUNT) {
      throw ApiError.badRequest(`Mínimo ${POINTS_PER_DISCOUNT} puntos para canjear`);
    }
    if (amount % POINTS_PER_DISCOUNT !== 0) {
      throw ApiError.badRequest(`Los puntos deben ser múltiplo de ${POINTS_PER_DISCOUNT}`);
    }

    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    if (user.points < amount) {
      throw ApiError.badRequest(`Puntos insuficientes. Tienes ${user.points} puntos.`);
    }

    const discount = (amount / POINTS_PER_DISCOUNT);
    user.points -= amount;
    user.pointsHistory.push({ amount: -amount, reason: `Canje por S/ ${discount.toFixed(2)} de descuento` });
    await user.save();

    res.json({
      discount: Math.round(discount * 100) / 100,
      remainingPoints: user.points,
    });
  })
);

module.exports = router;
