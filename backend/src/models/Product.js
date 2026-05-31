'use strict';

const { Schema, model } = require('mongoose');

/**
 * Producto del catálogo.
 * Usamos `_id` de tipo String para conservar los identificadores legibles
 * ("prod-1", "prod-2", ...) que ya usaban el frontend y los pedidos.
 */
const productSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // % de descuento
    category: { type: String, required: true, index: true },
    image: { type: String, default: '' },
    stock: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// Precio final con el descuento del propio producto aplicado.
productSchema.virtual('finalPrice').get(function getFinalPrice() {
  const discount = Number(this.discount) || 0;
  return Math.round(this.price * (1 - discount / 100) * 100) / 100;
});

module.exports = model('Product', productSchema);
