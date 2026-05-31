'use strict';

// Carga las variables de entorno (.env) antes que cualquier otra cosa.
require('dotenv').config();

const app = require('./app');
const config = require('./config/env');
const { connectDB, mongoose } = require('./config/db');

const start = async () => {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      console.log(
        `EasyMarket backend en http://localhost:${config.port} [${config.env}]`
      );
    });

    // Cierre ordenado: primero el servidor HTTP, luego la conexión a Mongo.
    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido. Cerrando...`);
      server.close(async () => {
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
