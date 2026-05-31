'use strict';

/**
 * Configuración centralizada de la aplicación.
 * Todas las variables de entorno se leen aquí, en un solo lugar,
 * para no esparcir `process.env` por todo el código.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,

  // Conexión a MongoDB. La URI NUNCA va en el código: se lee de .env
  mongo: {
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB || 'easymarket_db',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'easymarket_secret_key_2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  },

  // Costo de envío para pedidos con entrega a domicilio (delivery).
  shipping: {
    deliveryCost: Number(process.env.DELIVERY_COST) || 10,
    freeShippingThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD) || 150,
  },

  // Configuración SMTP para las alertas por correo. Si no se define,
  // el emailService cae a un "transporte de consola" (no envía nada real).
  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'EasyMarket <no-reply@easymarket.pe>',
    // Umbral de descuento (%) a partir del cual se notifica a los usuarios.
    offerThreshold: Number(process.env.OFFER_ALERT_THRESHOLD) || 50,
  },
};

module.exports = config;
