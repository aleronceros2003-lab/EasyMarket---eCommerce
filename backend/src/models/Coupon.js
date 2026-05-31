'use strict';

const { Schema, model } = require('mongoose');

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percentage', 'fixed', 'shipping'], required: true },
    value: { type: Number, default: 0 },
    minPurchase: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  {
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret._id;
        return ret;
      },
    },
  }
);

module.exports = model('Coupon', couponSchema);
