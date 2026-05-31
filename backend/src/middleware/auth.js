'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Extrae y verifica el token JWT del header Authorization.
 * @param {import('express').Request} req
 * @returns {object|null} payload decodificado o null si no hay/no es válido.
 */
const extractUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
};

/**
 * Middleware que EXIGE autenticación. Si no hay token válido, devuelve 401.
 */
const authenticate = (req, _res, next) => {
  const user = extractUser(req);
  if (!user) {
    return next(ApiError.unauthorized('Token no proporcionado o inválido'));
  }
  req.user = user;
  next();
};

/**
 * Middleware OPCIONAL. Si hay token válido, adjunta req.user; si no, continúa
 * sin error. Útil para endpoints públicos que personalizan la respuesta cuando
 * el usuario ha iniciado sesión (p. ej. registrar vistas de producto).
 */
const optionalAuth = (req, _res, next) => {
  const user = extractUser(req);
  if (user) req.user = user;
  next();
};

/**
 * Firma un token JWT para un usuario.
 * @param {{ id: string, email: string }} user
 * @returns {string}
 */
const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

module.exports = { authenticate, optionalAuth, signToken };
