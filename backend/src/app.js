'use strict';

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const couponRoutes = require('./routes/coupons');
const reviewRoutes = require('./routes/reviews');
const configRoutes = require('./routes/config');
const adminRoutes = require('./routes/admin');
const recommendationsRoutes = require('./routes/recommendations');
const wishlistRoutes = require('./routes/wishlist');
const pointsRoutes = require('./routes/points');
const notificationsRoutes = require('./routes/notifications');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // 5mb por si el avatar viaja en base64

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'EasyMarket API funcionando' });
});

// 404 y manejador central de errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
