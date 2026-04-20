const express = require('express');
const { readJSON, writeJSON } = require('../middleware/store');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: get or create cart for user
const getUserCart = (userId) => {
  const carts = readJSON('carts.json');
  let cart = carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = { userId, items: [] };
    carts.push(cart);
    writeJSON('carts.json', carts);
  }
  return cart;
};

// GET /api/cart  — get current user's cart
router.get('/', authenticate, (req, res) => {
  const cart = getUserCart(req.user.id);
  const products = readJSON('products.json');

  const enriched = cart.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return { ...item, product };
  });

  const total = enriched.reduce(
    (sum, item) => sum + (item.product ? item.product.price * item.quantity : 0),
    0
  );

  res.json({ items: enriched, total: parseFloat(total.toFixed(2)) });
});

// POST /api/cart/items  — add item to cart
router.post('/items', authenticate, (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const products = readJSON('products.json');
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const carts = readJSON('carts.json');
  let cartIndex = carts.findIndex((c) => c.userId === req.user.id);
  if (cartIndex === -1) {
    carts.push({ userId: req.user.id, items: [] });
    cartIndex = carts.length - 1;
  }

  const cart = carts[cartIndex];
  const existingIndex = cart.items.findIndex((i) => i.productId === productId);

  if (existingIndex !== -1) {
    cart.items[existingIndex].quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }

  carts[cartIndex] = cart;
  writeJSON('carts.json', carts);

  res.json({ message: 'Item added to cart', cart: cart.items });
});

// PUT /api/cart/items/:productId  — update item quantity
router.put('/items/:productId', authenticate, (req, res) => {
  const { quantity } = req.body;
  const { productId } = req.params;

  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  const carts = readJSON('carts.json');
  const cartIndex = carts.findIndex((c) => c.userId === req.user.id);
  if (cartIndex === -1) {
    return res.status(404).json({ error: 'Cart not found' });
  }

  const cart = carts[cartIndex];
  const itemIndex = cart.items.findIndex((i) => i.productId === productId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found in cart' });
  }

  if (quantity === 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity = quantity;
  }

  carts[cartIndex] = cart;
  writeJSON('carts.json', carts);

  res.json({ message: 'Cart updated', cart: cart.items });
});

// DELETE /api/cart/items/:productId  — remove item from cart
router.delete('/items/:productId', authenticate, (req, res) => {
  const { productId } = req.params;

  const carts = readJSON('carts.json');
  const cartIndex = carts.findIndex((c) => c.userId === req.user.id);
  if (cartIndex === -1) {
    return res.status(404).json({ error: 'Cart not found' });
  }

  const cart = carts[cartIndex];
  cart.items = cart.items.filter((i) => i.productId !== productId);
  carts[cartIndex] = cart;
  writeJSON('carts.json', carts);

  res.json({ message: 'Item removed from cart', cart: cart.items });
});

// DELETE /api/cart  — clear entire cart
router.delete('/', authenticate, (req, res) => {
  const carts = readJSON('carts.json');
  const cartIndex = carts.findIndex((c) => c.userId === req.user.id);
  if (cartIndex !== -1) {
    carts[cartIndex].items = [];
    writeJSON('carts.json', carts);
  }
  res.json({ message: 'Cart cleared' });
});

module.exports = router;
