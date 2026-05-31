'use strict';

const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    avatar: { type: String, default: '' },
    emailAlerts: { type: Boolean, default: false },
    // Historial de productos vistos (para recomendaciones), más reciente primero.
    viewedProductIds: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.password; // nunca exponer el hash
        return ret;
      },
    },
  }
);

module.exports = model('User', userSchema);
