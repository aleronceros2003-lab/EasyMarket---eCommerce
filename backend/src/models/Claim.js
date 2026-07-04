'use strict';

const { Schema, model } = require('mongoose');

const claimMessageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ['user', 'admin'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
    toJSON: {
      transform: (_doc, ret) => {
        return ret;
      },
    },
  }
);

const claimSchema = new Schema(
  {
    orderId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'resolved', 'invalid'],
      default: 'open',
    },
    messages: { type: [claimMessageSchema], default: [] },
  },
  {
    timestamps: true,
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

module.exports = model('Claim', claimSchema);
