'use strict';

const { authenticate } = require('./auth');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('./asyncHandler');

const adminAuth = asyncHandler(async (req, res, next) => {
  await new Promise((resolve, reject) => {
    authenticate(req, res, (err) => (err ? reject(err) : resolve()));
  });
  const user = await User.findById(req.user.id).select('role');
  if (!user || user.role !== 'admin') {
    throw ApiError.forbidden('Acceso restringido a administradores');
  }
  next();
});

module.exports = adminAuth;
