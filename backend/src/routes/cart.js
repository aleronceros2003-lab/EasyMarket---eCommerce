'use strict';

const express = require('express');

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { finalPrice, buildTotals } = require('../utils/pricing');
const { toPositiveInt } = require('../utils/validators');

const router = express.Router();

/**
 * Enriquece los ítems del carrito con datos del producto, precio final y
 * subtotal, y devuelve también el desglose de totales.
 * @param {{productId:string, quantity:number}[]} cartItems
 */
const buildCartResponse = async (cartItems) => {
  if (cartItems.length === 0) return { items: [], totals: buildTotals([]) };

  const ids = cartItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [p._id, p]));

  const items = cartItems
    .map((item) => {
      const product = byId.get(item.productId);
      if (!product) return null; // producto retirado del catálogo
      const unitPrice = finalPrice(product);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product.toJSON(),
        subtotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    })
    .filter(Boolean);

  const pricingItems = items.map((i) => ({
    price: i.product.price,
    discount: i.product.discount,
    quantity: i.quantity,
  }));

  return { items, totals: buildTotals(pricingItems) };
};

// GET /api/cart
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ userId: req.user.id }).lean();
    res.json(await buildCartResponse(cart ? cart.items : []));
  })
);

// POST /api/cart/items
router.post(
  '/items',
  authenticate,
  asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const quantity = toPositiveInt(req.body.quantity ?? 1, { field: 'quantity' });
    if (!productId) throw ApiError.badRequest('productId es obligatorio');

    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Producto no encontrado');
    if (product.stock < quantity) {
      throw ApiError.badRequest('Stock insuficiente para la cantidad solicitada');
    }

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) existing.quantity += quantity;
    else cart.items.push({ productId, quantity });

    await cart.save();
    res
      .status(201)
      .json({ message: 'Producto agregado al carrito', ...(await buildCartResponse(cart.items)) });
  })
);

// PUT /api/cart/items/:productId  (quantity 0 = eliminar)
router.put(
  '/items/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || !Number.isInteger(quantity) || quantity < 0) {
      throw ApiError.badRequest('Se requiere una cantidad válida (entero >= 0)');
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) throw ApiError.notFound('Carrito no encontrado');
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw ApiError.notFound('Ítem no encontrado en el carrito');

    if (quantity === 0) cart.items = cart.items.filter((i) => i.productId !== productId);
    else item.quantity = quantity;

    await cart.save();
    res.json({ message: 'Carrito actualizado', ...(await buildCartResponse(cart.items)) });
  })
);

// DELETE /api/cart/items/:productId
router.delete(
  '/items/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) throw ApiError.notFound('Carrito no encontrado');
    cart.items = cart.items.filter((i) => i.productId !== productId);
    await cart.save();
    res.json({ message: 'Producto eliminado del carrito', ...(await buildCartResponse(cart.items)) });
  })
);

// DELETE /api/cart  — vaciar
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
    res.json({ message: 'Carrito vaciado', ...(await buildCartResponse([])) });
  })
);

module.exports = router;
