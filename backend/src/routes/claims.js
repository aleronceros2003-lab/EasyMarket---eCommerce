'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const Claim = require('../models/Claim');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendPushNotification } = require('../services/pushService');

const router = express.Router();

// GET /api/claims
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const claims = await Claim.find(filter).sort({ createdAt: -1 });
    res.json(claims.map((c) => c.toJSON()));
  })
);

// POST /api/claims
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { orderId, productId, comment } = req.body;
    
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) throw ApiError.notFound('Pedido no encontrado');
    
    const existing = await Claim.findOne({ orderId, productId, userId: req.user._id });
    if (existing) throw ApiError.badRequest('Ya existe un reclamo para este producto en este pedido');

    const claim = await Claim.create({
      orderId,
      productId,
      userId: req.user._id,
      messages: comment ? [{ senderId: req.user._id, senderRole: 'user', content: comment }] : [],
    });

    const io = req.app.get('io');
    if (io) {
      if (comment && Array.isArray(claim.messages) && claim.messages[0]) {
        io.to(`claim_${claim._id}`).emit('new_message', { claimId: claim._id, message: claim.messages[0] });
      }
      io.to(`claim_${claim._id}`).emit('claim_created', { claimId: claim._id, claim: claim.toJSON() });
      io.to('admin_claims').emit('claim_created', { claimId: claim._id, claim: claim.toJSON() });
    }

    const admins = await User.find({ role: 'admin', pushToken: { $ne: '' } }).select('pushToken');
    if (admins.length > 0) {
      await Promise.all(admins.map((admin) => sendPushNotification(
        admin.pushToken,
        '📝 Nuevo reclamo',
        `Pedido #${order.id.slice(0, 8).toUpperCase()} requiere revisión`,
        { claimId: claim.id, orderId: order.id }
      )));
    }
    
    res.status(201).json(claim.toJSON());
  })
);

// GET /api/claims/:id
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const claim = await Claim.findById(req.params.id);
    if (!claim) throw ApiError.notFound('Reclamo no encontrado');
    if (req.user.role !== 'admin' && claim.userId !== req.user._id.toString()) {
      throw ApiError.unauthorized('No tienes permiso para ver este reclamo');
    }
    res.json(claim.toJSON());
  })
);

// POST /api/claims/:id/messages
router.post(
  '/:id/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content) throw ApiError.badRequest('El mensaje no puede estar vacío');
    
    const claim = await Claim.findById(req.params.id);
    if (!claim) throw ApiError.notFound('Reclamo no encontrado');
    
    if (req.user.role !== 'admin' && claim.userId !== req.user._id.toString()) {
      throw ApiError.unauthorized('No tienes permiso');
    }

    const message = {
      senderId: req.user._id.toString(),
      senderRole: req.user.role,
      content,
      createdAt: new Date(),
    };

    claim.messages.push(message);
    await claim.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`claim_${claim._id}`).emit('new_message', { claimId: claim._id, message });
    }

    res.json(claim.toJSON());
  })
);

// PATCH /api/claims/:id/status
router.patch(
  '/:id/status',
  adminAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['open', 'resolved', 'invalid'].includes(status)) {
      throw ApiError.badRequest('Estado inválido');
    }
    
    const claim = await Claim.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!claim) throw ApiError.notFound('Reclamo no encontrado');
    
    const io = req.app.get('io');
    if (io) {
      io.to(`claim_${claim._id}`).emit('claim_status_updated', { claimId: claim._id, status });
    }

    res.json(claim.toJSON());
  })
);

module.exports = router;
