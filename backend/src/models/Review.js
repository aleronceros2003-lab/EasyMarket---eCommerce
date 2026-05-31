'use strict';

const { Schema, model } = require('mongoose');

const reviewSchema = new Schema(
  {
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    appRating: { type: Number, required: true, min: 1, max: 5 },
    deliveryRating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    products: {
      type: [
        new Schema(
          {
            productId: { type: String, required: true },
            rating: { type: Number, required: true, min: 1, max: 5 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
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

module.exports = model('Review', reviewSchema);
