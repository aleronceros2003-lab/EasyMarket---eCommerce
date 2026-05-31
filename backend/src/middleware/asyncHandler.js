'use strict';

/**
 * Envuelve un controlador (sync o async) y reenvía cualquier error a `next()`,
 * de modo que no haga falta repetir try/catch en cada ruta.
 *
 * @param {(req, res, next) => any} fn
 * @returns {(req, res, next) => void}
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
