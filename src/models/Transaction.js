'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId:   { type: String, required: true, unique: true, index: true },
  orderId:         { type: String, required: true, unique: true, index: true },
  userId:          { type: Number, required: true, index: true },
  plan:            { type: String, enum: ['pro', 'unlimited'], required: true },
  amountOriginal:  { type: Number, required: true },
  amountUnique:    { type: Number, default: 0 },
  amountTotal:     { type: Number, required: true },
  qrisContent:     { type: String, default: null },
  qrisImageUrl:    { type: String, default: null },
  status:          { type: String, enum: ['pending', 'paid', 'expired', 'cancelled'], default: 'pending', index: true },
  expiresAt:       { type: Date, default: null },
  paidAt:          { type: Date, default: null },
  createdAt:       { type: Date, default: Date.now },
  updatedAt:       { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
