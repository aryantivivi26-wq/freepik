'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const { Transaction } = require('../models');

const hubifyClient = axios.create({
  baseURL: config.hubify.baseUrl,
  headers: {
    Authorization: `Bearer ${config.hubify.apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ─────────────────────────────────────────
// CREATE TRANSACTION
// ─────────────────────────────────────────

/**
 * Create a new QRIS payment transaction.
 * @param {number} userId - Telegram user ID
 * @param {string} plan - 'pro' | 'unlimited'
 * @returns {object} transaction doc + Hubify response
 */
async function createTransaction(userId, plan) {
  const planConfig = config.plans[plan];
  if (!planConfig || planConfig.price === 0) {
    throw new Error(`Invalid paid plan: ${plan}`);
  }

  const orderId = `ORDER-${userId}-${Date.now()}`;
  const amount = planConfig.price;

  const response = await hubifyClient.post('/create-transaction', {
    amount,
    order_id: orderId,
    customer_id: String(userId),
  });

  if (!response.data?.success) {
    throw new Error(`Hubify create-transaction failed: ${JSON.stringify(response.data)}`);
  }

  const {
    transaction_id,
    amount_original,
    amount_unique,
    amount_total,
    qris_content,
    qris_image_url,
    expires_at,
  } = response.data;

  // Save to MongoDB
  const txDoc = await Transaction.create({
    transactionId: transaction_id,
    orderId,
    userId,
    plan,
    amountOriginal: amount_original,
    amountUnique: amount_unique,
    amountTotal: amount_total,
    qrisContent: qris_content || null,
    qrisImageUrl: qris_image_url || null,
    status: 'pending',
    expiresAt: expires_at ? new Date(expires_at) : null,
  });

  return {
    txDoc,
    transactionId: transaction_id,
    amountOriginal: amount_original,
    amountUnique: amount_unique,
    amountTotal: amount_total,
    qrisContent: qris_content,
    qrisImageUrl: qris_image_url,
    expiresAt: expires_at,
    orderId,
  };
}

// ─────────────────────────────────────────
// CHECK STATUS
// ─────────────────────────────────────────

/**
 * Check transaction status from Hubify.
 * @param {string} transactionId
 * @returns {string} 'pending' | 'paid' | 'expired'
 */
async function checkTransactionStatus(transactionId) {
  const response = await hubifyClient.get(`/check-status/${transactionId}`);

  if (!response.data?.success) {
    throw new Error(`Hubify check-status failed: ${JSON.stringify(response.data)}`);
  }

  return response.data.transaction;
}

// ─────────────────────────────────────────
// LIST TRANSACTIONS
// ─────────────────────────────────────────

/**
 * List transactions from Hubify.
 * @param {object} params - { status, limit, offset }
 */
async function listTransactions(params = {}) {
  const response = await hubifyClient.get('/transactions', { params });

  if (!response.data?.success) {
    throw new Error(`Hubify list-transactions failed`);
  }

  return response.data;
}

// ─────────────────────────────────────────
// WEBHOOK SIGNATURE VERIFICATION
// ─────────────────────────────────────────

/**
 * Verify Hubify webhook signature.
 * @param {string} rawBody - raw request body string
 * @param {string} signature - X-Webhook-Signature header value
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!config.hubify.webhookSecret || !signature) return false;

  // Normalize: strip optional "sha256=" prefix, force lowercase
  const normalizedSig = signature.replace(/^sha256=/i, '').toLowerCase();

  // Validate: must be exactly 64 hex characters (32 bytes)
  // timingSafeEqual throws RangeError if buffers have different lengths
  if (!/^[0-9a-f]{64}$/.test(normalizedSig)) return false;

  const expected = crypto
    .createHmac('sha256', config.hubify.webhookSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(normalizedSig, 'hex')
  );
}

// ─────────────────────────────────────────
// PARSE ORDER ID
// ─────────────────────────────────────────

/**
 * Extract userId from orderId format: ORDER-{userId}-{timestamp}
 * @param {string} orderId
 * @returns {number} userId
 */
function parseUserIdFromOrderId(orderId) {
  const parts = orderId.split('-');
  // ORDER-{userId}-{timestamp} → parts[1]
  if (parts.length >= 3 && parts[0] === 'ORDER') {
    return parseInt(parts[1], 10);
  }
  throw new Error(`Invalid orderId format: ${orderId}`);
}

// ─────────────────────────────────────────
// POLL PAYMENT STATUS (for bot-side polling)
// ─────────────────────────────────────────

/**
 * Poll payment until paid or expired (for background checking).
 * @param {string} transactionId
 * @param {number} maxAttempts
 * @param {number} intervalMs
 * @returns {'paid'|'expired'|'timeout'}
 */
async function pollPayment(transactionId, maxAttempts = 60, intervalMs = 10000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await checkTransactionStatus(transactionId);
      if (tx.status === 'paid') return 'paid';
      if (tx.status === 'expired') return 'expired';
    } catch (err) {
      console.error(`[Hubify] Poll error for ${transactionId}:`, err.message);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return 'timeout';
}

module.exports = {
  createTransaction,
  checkTransactionStatus,
  listTransactions,
  verifyWebhookSignature,
  parseUserIdFromOrderId,
  pollPayment,
};
