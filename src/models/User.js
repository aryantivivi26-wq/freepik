'use strict';

const mongoose = require('mongoose');

const creditsSchema = new mongoose.Schema({
  image: { type: Number, default: 5 },
  video: { type: Number, default: 2 },
  music: { type: Number, default: 3 },
  tts:   { type: Number, default: 10 },
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
  activeJobs:  { type: Number, default: 0 },
  totalJobs:   { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

userSchema.methods.hasCredits = function (type) {
  return (this.credits[type] || 0) > 0;
};

userSchema.methods.deductCredit = async function (type) {
  if ((this.credits[type] || 0) <= 0) {
    throw new Error(`Insufficient ${type} credits`);
  }
  this.credits[type] -= 1;
  await this.save();
};

userSchema.methods.refundCredit = async function (type) {
  this.credits[type] = (this.credits[type] || 0) + 1;
  await this.save();
};

userSchema.methods.isPlanActive = function () {
  if (this.plan === 'free') return true;
  if (!this.planExpiresAt) return false;
  return new Date() < new Date(this.planExpiresAt);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
