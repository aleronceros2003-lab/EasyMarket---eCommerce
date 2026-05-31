'use strict';

const mongoose = require('mongoose');
const config = require('./env');

/**
 * Conecta a MongoDB. Lanza si no hay URI o si la conexión falla,
 * para que el arranque del servidor se detenga con un error claro.
 */
const connectDB = async () => {
  if (!config.mongo.uri) {
    throw new Error(
      'Falta MONGODB_URI. Crea un archivo .env en /backend con tu cadena de conexión.'
    );
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(config.mongo.uri, {
    dbName: config.mongo.dbName,
  });

  console.log(`MongoDB conectado (db: ${config.mongo.dbName})`);
};

module.exports = { connectDB, mongoose };
