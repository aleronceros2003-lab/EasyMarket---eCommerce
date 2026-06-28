'use strict';

require('dotenv').config();

const { createServer } = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const { connectDB, mongoose } = require('./config/db');
const stockEmitter = require('./services/stockEmitter');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  socket.on('join_product', (productId) => socket.join(`product_${productId}`));
  socket.on('leave_product', (productId) => socket.leave(`product_${productId}`));
});

stockEmitter.on('stock_update', ({ productId, stock }) => {
  io.to(`product_${productId}`).emit('stock_updated', { productId, stock });
});

const start = async () => {
  try {
    await connectDB();

    httpServer.listen(config.port, () => {
      console.log(`EasyMarket backend en http://localhost:${config.port} [${config.env}]`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido. Cerrando...`);
      httpServer.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('No se pudo iniciar el servidor:', err.message);
    process.exit(1);
  }
};

start();
