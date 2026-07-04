'use strict';

const { Schema, model } = require('mongoose');

const DELIVERY_STATUSES = ['preparing', 'on_the_way', 'at_door', 'delivered', 'finalized'];

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
    status: { type: String, enum: DELIVERY_STATUSES },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complaintMessageSchema = new Schema(
  {
    sender: { type: String, enum: ['user', 'admin'], required: true },
    text: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complaintSchema = new Schema(
  {
    text: { type: String, required: true },
    status: { type: String, enum: ['pending', 'valid', 'invalid'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    messages: { type: [complaintMessageSchema], default: [] },
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
      enum: DELIVERY_STATUSES,
      default: 'preparing',
    },
    statusHistory: { type: [statusEntrySchema], default: [] },
    rated: { type: Boolean, default: false },
    complaint: { type: complaintSchema, default: null },
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