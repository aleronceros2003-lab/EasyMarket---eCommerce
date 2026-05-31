'use strict';

const { Schema, model } = require('mongoose');

const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    // Guardamos el id del usuario como string (el mismo que viaja en el JWT).
    userId: { type: String, required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { versionKey: false }
);

module.exports = model('Cart', cartSchema);
