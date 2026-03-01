'use strict';

const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  key:         { type: String, required: true, unique: true },
  label:       { type: String, default: null },          // friendly name e.g. "Key #1"
  isActive:    { type: Boolean, default: true, index: true },
  requestCount:{ type: Number, default: 0 },             // total requests made
  lastUsedAt:  { type: Date, default: null },
  errorCount:  { type: Number, default: 0 },             // consecutive errors
  addedBy:     { type: Number, default: null },           // admin telegramId
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

/**
 * Mask an API key for display: show first 8 and last 4 chars.
 */
apiKeySchema.methods.masked = function () {
  const k = this.key;
  if (k.length <= 12) return '****';
  return `${k.slice(0, 8)}...${k.slice(-4)}`;
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
