'use strict';

const mongoose = require('mongoose');

const creditsSchema = new mongoose.Schema({
  image: { type: Number, default: 5 },
  video: { type: Number, default: 2 },
  music: { type: Number, default: 3 },
  tts:   { type: Number, default: 10 },
  sfx:   { type: Number, default: 5 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  telegramId:  { type: Number, required: true, unique: true, index: true },
  username:    { type: String, default: null },
  firstName:   { type: String, default: null },
  lastName:    { type: String, default: null },
  plan:        { type: String, enum: ['free', 'pro', 'unlimited'], default: 'free' },
  credits:     { type: creditsSchema, default: () => ({}) },
  planExpiresAt: { type: Date, default: null },
  isBanned:    { type: Boolean, default: false },
  totalJobs:   { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

userSchema.methods.hasCredits = function (type) {
  return (this.credits[type] || 0) > 0;
};

/**
 * Atomically deduct 1 credit. Returns the updated user or null if insufficient.
 * Uses findOneAndUpdate so concurrent requests cannot over-deduct.
 */
userSchema.statics.atomicDeductCredit = async function (telegramId, type) {
  const filter = { telegramId, [`credits.${type}`]: { $gte: 1 } };
  const update = { $inc: { [`credits.${type}`]: -1 } };
  const updated = await this.findOneAndUpdate(filter, update, { new: true });
  return updated; // null means insufficient credits
};

/**
 * Atomically refund 1 credit.
 */
userSchema.statics.atomicRefundCredit = async function (telegramId, type) {
  const update = { $inc: { [`credits.${type}`]: 1 } };
  return this.findOneAndUpdate({ telegramId }, update, { new: true });
};

/**
 * @deprecated Use User.atomicDeductCredit() for concurrency safety.
 * Kept for backward compatibility.
 */
userSchema.methods.deductCredit = async function (type) {
  const result = await this.constructor.atomicDeductCredit(this.telegramId, type);
  if (!result) throw new Error(`Insufficient ${type} credits`);
  this.credits[type] = result.credits[type];
  return this;
};

userSchema.methods.refundCredit = async function (type) {
  const result = await this.constructor.atomicRefundCredit(this.telegramId, type);
  if (result) this.credits[type] = result.credits[type];
  return this;
};

userSchema.methods.isPlanActive = function () {
  if (this.plan === 'free') return true;
  if (!this.planExpiresAt) return false;
  return new Date() < new Date(this.planExpiresAt);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
