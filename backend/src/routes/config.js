'use strict';

const express = require('express');
const config = require('../config/env');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/config/pickup-centers  — retorna array con nombre, dirección y coordenadas
router.get(
  '/pickup-centers',
  asyncHandler(async (_req, res) => {
    res.json(config.pickupCentersData);
  })
);

// GET /api/config/shipping
router.get(
  '/shipping',
  asyncHandler(async (_req, res) => {
    res.json({
      deliveryCost: config.shipping.deliveryCost,
      freeShippingThreshold: config.shipping.freeShippingThreshold,
    });
  })
);

module.exports = router;
