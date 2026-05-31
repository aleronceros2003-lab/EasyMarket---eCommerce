'use strict';

/**
 * Siembra MongoDB con el catálogo y los cupones base, y limpia los datos
 * transaccionales (usuarios, carritos, pedidos, reseñas).
 * Uso: npm run seed
 */
require('dotenv').config();

const { connectDB, mongoose } = require('./config/db');
const Product = require('./models/Product');
const Coupon = require('./models/Coupon');
const User = require('./models/User');
const Cart = require('./models/Cart');
const Order = require('./models/Order');
const Review = require('./models/Review');

const products = require('./data/products.json');
const coupons = require('./data/coupons.json');

const run = async () => {
  await connectDB();

  // Catálogo: se reemplaza por completo para dejar un esquema consistente
  // (esto elimina también documentos antiguos/incompatibles, p. ej. los que
  // usaban `type` en vez de `category`).
  await Product.deleteMany({});
  await Product.insertMany(products.map(({ id, ...rest }) => ({ _id: id, ...rest })));

  // Cupones: se reemplazan por completo.
  await Coupon.deleteMany({});
  await Coupon.insertMany(coupons);

  // Datos transaccionales: se reinician.
  await Promise.all([
    User.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
  ]);

  const [pCount, cCount] = await Promise.all([Product.countDocuments(), Coupon.countDocuments()]);
  console.log(`Seed completado: ${pCount} productos, ${cCount} cupones.`);
  console.log('Usuarios, carritos, pedidos y reseñas reiniciados.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Error en el seed:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
