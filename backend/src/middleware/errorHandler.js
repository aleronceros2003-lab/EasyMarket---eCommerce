'use strict';

const config = require('../config/env');
const ApiError = require('../utils/ApiError');

/** Middleware para rutas no encontradas (404). Debe ir antes del errorHandler. */
const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/**
 * Manejador central de errores. Debe registrarse al final, con 4 argumentos.
 * Traduce ApiError, errores de JSON malformado y errores inesperados.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Body JSON inválido (lanzado por express.json()).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }

  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    // Log completo solo para errores 5xx (bugs reales).
    console.error('[ERROR]', err);
  }

  const body = {
    error: isServerError && config.env === 'production'
      ? 'Error interno del servidor'
      : err.message,
  };

  if (err.details) body.details = err.details;
  if (config.env !== 'production' && isServerError) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
