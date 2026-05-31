'use strict';

const Product = require('../models/Product');
const User = require('../models/User');

/**
 * Genera recomendaciones personalizadas en base a las categorías de los
 * productos que el usuario ha visto.
 *
 *  1. Cuenta vistas por categoría.
 *  2. Prioriza productos NO vistos de las categorías más vistas.
 *  3. Rellena con los mejor valorados.
 *
 * @param {object|null} user        Usuario con `viewedProductIds`.
 * @param {object[]} allProducts    Catálogo (objetos planos con id/category/rating/finalPrice).
 * @param {number} [limit]
 * @returns {object[]}
 */
const getRecommendations = (user, allProducts, limit = 8) => {
  const viewedIds = new Set(user?.viewedProductIds || []);

  const categoryScore = {};
  for (const id of viewedIds) {
    const product = allProducts.find((p) => p.id === id);
    if (product) {
      categoryScore[product.category] = (categoryScore[product.category] || 0) + 1;
    }
  }

  const rankedCategories = Object.keys(categoryScore).sort(
    (a, b) => categoryScore[b] - categoryScore[a]
  );

  const recommended = [];
  const pushed = new Set();

  // 1) Productos no vistos de las categorías preferidas.
  for (const category of rankedCategories) {
    const candidates = allProducts
      .filter((p) => p.category === category && !viewedIds.has(p.id) && !pushed.has(p.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    for (const p of candidates) {
      recommended.push(p);
      pushed.add(p.id);
      if (recommended.length >= limit) break;
    }
    if (recommended.length >= limit) break;
  }

  // 2) Relleno con los mejor valorados (no vistos / no incluidos).
  if (recommended.length < limit) {
    const fillers = allProducts
      .filter((p) => !viewedIds.has(p.id) && !pushed.has(p.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    for (const p of fillers) {
      recommended.push(p);
      pushed.add(p.id);
      if (recommended.length >= limit) break;
    }
  }

  return recommended;
};

/**
 * Obtiene recomendaciones leyendo usuario y catálogo desde MongoDB.
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
const recommendForUser = async (userId, limit = 8) => {
  const [user, products] = await Promise.all([
    User.findById(userId).lean(),
    Product.find(),
  ]);
  // toJSON añade `id` y el virtual `finalPrice`.
  const catalog = products.map((p) => p.toJSON());
  return getRecommendations(user, catalog, limit);
};

module.exports = { getRecommendations, recommendForUser };
