'use strict';

const { Schema, model } = require('mongoose');

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    name: String,
    price: Number,
    discount: Number,
    finalPrice: Number,
    quantity: Number,
    image: String,
    subtotal: Number,
  },
  { _id: false }
);

const statusEntrySchema = new Schema(
  {
    status: { type: String, enum: ['preparing', 'on_the_way', 'delivered'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: Number,
    productDiscount: Number,
    couponCode: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    shipping: Number,
    total: Number,
    paymentMethod: { type: String, enum: ['card', 'cash_on_delivery'], required: true },
    deliveryType: { type: String, enum: ['delivery', 'pickup'], required: true },
    shippingAddress: { type: String, default: null },
    pickupCenter: { type: String, default: null },
    status: {
      type: String,
      enum: ['preparing', 'on_the_way', 'delivered'],
      default: 'preparing',
    },
    statusHistory: { type: [statusEntrySchema], default: [] },
    rated: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

module.exports = model('Order', orderSchema);
