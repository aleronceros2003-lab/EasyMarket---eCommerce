const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../middleware/store');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders/checkout  — place order from current cart
router.post('/checkout', authenticate, (req, res) => {
  const { shippingAddress, paymentMethod = 'card' } = req.body;

  if (!shippingAddress) {
    return res.status(400).json({ error: 'Shipping address is required' });
  }

  const carts = readJSON('carts.json');
  const cart = carts.find((c) => c.userId === req.user.id);

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const products = readJSON('products.json');

  const orderItems = cart.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      name: product ? product.name : 'Unknown Product',
      price: product ? product.price : 0,
      quantity: item.quantity,
      image: product ? product.image : '',
      subtotal: product ? parseFloat((product.price * item.quantity).toFixed(2)) : 0,
    };
  });

  const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

  const order = {
    id: uuidv4(),
    userId: req.user.id,
    items: orderItems,
    total: parseFloat(total.toFixed(2)),
    shippingAddress,
    paymentMethod,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  const orders = readJSON('orders.json');
  orders.push(order);
  writeJSON('orders.json', orders);

  // Clear the cart after checkout
  const cartIndex = carts.findIndex((c) => c.userId === req.user.id);
  if (cartIndex !== -1) {
    carts[cartIndex].items = [];
    writeJSON('carts.json', carts);
  }

  res.status(201).json(order);
});

// GET /api/orders  — get current user's purchase history
router.get('/', authenticate, (req, res) => {
  const orders = readJSON('orders.json');
  const userOrders = orders
    .filter((o) => o.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(userOrders);
});

// GET /api/orders/:id  — get order detail
router.get('/:id', authenticate, (req, res) => {
  const orders = readJSON('orders.json');
  const order = orders.find(
    (o) => o.id === req.params.id && o.userId === req.user.id
  );
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

module.exports = router;
