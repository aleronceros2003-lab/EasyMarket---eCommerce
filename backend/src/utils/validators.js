'use strict';

const ApiError = require('./ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requireFields = (body, fields) => {
  const missing = fields.filter((f) => {
    const v = body?.[f];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length) {
    throw ApiError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`, { fields: missing });
  }
};

const isValidEmail = (email) => typeof email === 'string' && EMAIL_RE.test(email);

const assertEmail = (email) => {
  if (!isValidEmail(email)) {
    throw ApiError.badRequest('El correo electrónico no es válido');
  }
};

const toPositiveInt = (value, { min = 1, max = Infinity, field = 'cantidad' } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw ApiError.badRequest(`El campo "${field}" debe ser un entero entre ${min} y ${max}`);
  }
  return n;
};

module.exports = { requireFields, isValidEmail, assertEmail, toPositiveInt, EMAIL_RE };