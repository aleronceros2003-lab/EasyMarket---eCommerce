'use strict';

const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const { couponDiscount } = require('../utils/pricing');

/**
 * Valida un cupón contra el subtotal dado. Lanza ApiError si no aplica.
 * @param {string} code
 * @param {number} subtotal
 * @returns {Promise<{ coupon: object, discount: number }>}
 */
const validateCoupon = async (code, subtotal) => {
  if (!code) throw ApiError.badRequest('Debes indicar un código de cupón');

  const coupon = await Coupon.findOne({ code: String(code).toUpperCase() }).lean();

  if (!coupon || !coupon.active) {
    throw ApiError.notFound('El cupón no existe o no está activo');
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    throw ApiError.badRequest('El cupón ha expirado');
  }
  if (subtotal < (coupon.minPurchase || 0)) {
    throw ApiError.badRequest(
      `Este cupón requiere una compra mínima de S/ ${Number(coupon.minPurchase).toFixed(2)}`
    );
  }

  return { coupon, discount: couponDiscount(coupon, subtotal) };
};

module.exports = { validateCoupon };
