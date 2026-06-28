'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/User');

const router = express.Router();

// POST /api/notifications/token
router.post(
  '/token',
  authenticate,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token requerido' });
    await User.findByIdAndUpdate(req.user.id, { pushToken: token });
    res.json({ message: 'Token registrado' });
  })
);

module.exports = router;
