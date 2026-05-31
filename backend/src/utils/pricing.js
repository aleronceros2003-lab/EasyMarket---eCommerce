'use strict';

const config = require('../config/env');

/** Redondea a 2 decimales devolviendo un número (no string). */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Precio final de un producto aplicando su descuento propio (% sobre price). */
const finalPrice = (product) => {
  const discount = Number(product.discount) || 0;
  return round2(product.price * (1 - discount / 100));
};

/** Descuento monetario de un cupón sobre un subtotal. */
const couponDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;
  if (coupon.type === 'percentage') return round2(subtotal * (coupon.value / 100));
  if (coupon.type === 'fixed') return round2(Math.min(coupon.value, subtotal));
  return 0; // 'shipping' u otros no afectan el subtotal de productos
};

/**
 * Costo de envío según tipo de entrega y subtotal.
 * - pickup: siempre 0. - delivery: gratis si supera el umbral o con cupón de envío.
 */
const shippingCost = (deliveryType, subtotal, coupon = null) => {
  if (deliveryType === 'pickup') return 0;
  if (coupon && coupon.type === 'shipping') return 0;
  if (subtotal >= config.shipping.freeShippingThreshold) return 0;
  return config.shipping.deliveryCost;
};

/** Construye el desglose completo de totales de un pedido. */
const buildTotals = (items, { coupon = null, deliveryType = 'delivery' } = {}) => {
  let listSubtotal = 0;
  let subtotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    listSubtotal += round2(item.price * qty);
    subtotal += round2(finalPrice(item) * qty);
  }

  listSubtotal = round2(listSubtotal);
  subtotal = round2(subtotal);

  const productDiscount = round2(listSubtotal - subtotal);
  const cDiscount = couponDiscount(coupon, subtotal);
  const shipping = shippingCost(deliveryType, subtotal, coupon);
  const total = round2(Math.max(0, subtotal - cDiscount) + shipping);

  return { subtotal, productDiscount, couponDiscount: cDiscount, shipping, total };
};

module.exports = { round2, finalPrice, couponDiscount, shippingCost, buildTotals };