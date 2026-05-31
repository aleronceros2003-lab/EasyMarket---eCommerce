'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const { authenticate, signToken } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireFields, assertEmail } = require('../utils/validators');
const config = require('../config/env');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, avatar, emailAlerts } = req.body;
    requireFields(req.body, ['name', 'email', 'password']);
    assertEmail(email);
    if (String(password).length < 6) {
      throw ApiError.badRequest('La contraseña debe tener al menos 6 caracteres');
    }

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) throw ApiError.conflict('El correo ya está registrado');

    const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      address: address || '',
      avatar: avatar || '',
      emailAlerts: Boolean(emailAlerts),
      viewedProductIds: [],
    });

    const token = signToken(user);
    res.status(201).json({ token, user: user.toJSON() });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    requireFields(req.body, ['email', 'password']);

    const user = await User.findOne({ email: String(email).toLowerCase() });

    // Compara siempre (exista o no el usuario) para no filtrar por tiempos.
    const hash = user ? user.password : '$2a$10$invalidinvalidinvalidinvalidinvalidinv';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) throw ApiError.unauthorized('Credenciales inválidas');

    const token = signToken(user);
    res.json({ token, user: user.toJSON() });
  })
);

// GET /api/auth/profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    res.json(user.toJSON());
  })
);

// PUT /api/auth/profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, phone, address, avatar, emailAlerts, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    if (newPassword) {
      if (String(newPassword).length < 6) {
        throw ApiError.badRequest('La nueva contraseña debe tener al menos 6 caracteres');
      }
      if (!currentPassword) throw ApiError.badRequest('Debes indicar tu contraseña actual');
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) throw ApiError.unauthorized('La contraseña actual es incorrecta');
      user.password = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;
    if (emailAlerts !== undefined) user.emailAlerts = Boolean(emailAlerts);

    await user.save();
    res.json(user.toJSON());
  })
);

module.exports = router;
