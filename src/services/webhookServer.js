'use strict';

const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { Transaction } = require('../models');
const { verifyWebhookSignature, parseUserIdFromOrderId } = require('./hubify');
const { upgradeUserPlan } = require('../utils/userHelper');

let webhookBot = null;

/**
 * Inject bot instance for sending notifications.
 */
function setWebhookBot(bot) {
  webhookBot = bot;
}

/**
 * Create and return the Express webhook app.
 */
function createWebhookServer() {
  const app = express();

  // ── Raw body capture + JSON parse in a single read pass ──────────────
  // express.raw() reads the stream once into req.body as Buffer.
  // We then capture rawBody (string) for HMAC verification, and parse JSON
  // into req.body so route handlers can use req.body normally.
  // This avoids the bug where a custom stream-reader consumes the request
  // before express.json() can read it, leaving req.body always empty.
  app.use(express.raw({ type: '*/*', limit: '1mb' }));
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8');
      try {
        req.body = JSON.parse(req.rawBody);
      } catch {
        req.body = {};
      }
    } else {
      req.rawBody = '';
    }
    next();
  });

  // ────────────────────────────────────────────────────
  // POST /webhook/hubify  — Hubify payment.completed
  // ────────────────────────────────────────────────────
  app.post('/webhook/hubify', async (req, res) => {
    try {
      // Verify signature
      const signature = req.headers['x-webhook-signature'];
      if (!verifyWebhookSignature(req.rawBody, signature)) {
        console.warn('[Webhook] Invalid signature from Hubify');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }

      // req.body is already parsed by the raw-body middleware above
      const payload = req.body;
      console.log('[Webhook] Received Hubify webhook:', payload);

      const { order_id, status, customer_id, amount, completed_at } = payload;

      if (status !== 'completed') {
        return res.json({ success: true, message: 'Non-completed event ignored' });
      }

      if (!order_id) {
        return res.status(400).json({ success: false, error: 'Missing order_id' });
      }

      // Find transaction by orderId
      const txDoc = await Transaction.findOne({ orderId: order_id });
      if (!txDoc) {
        console.error(`[Webhook] Transaction not found for order: ${order_id}`);
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (txDoc.status === 'paid') {
        return res.json({ success: true, message: 'Already processed' });
      }

      // Mark as paid
      txDoc.status = 'paid';
      txDoc.paidAt = completed_at ? new Date(completed_at) : new Date();
      await txDoc.save();

      // Parse userId
      let userId;
      try {
        userId = parseUserIdFromOrderId(order_id);
      } catch (_) {
        userId = customer_id ? parseInt(customer_id, 10) : null;
      }

      if (!userId) {
        console.error('[Webhook] Could not parse userId from order:', order_id);
        return res.status(400).json({ success: false, error: 'Cannot determine userId' });
      }

      // Upgrade user plan
      await upgradeUserPlan(userId, txDoc.plan);

      console.log(`[Webhook] User ${userId} upgraded to ${txDoc.plan}`);

      // Notify user via Telegram
      if (webhookBot) {
        try {
          const planLabel = txDoc.plan === 'pro' ? 'Pro' : 'Unlimited';
          await webhookBot.telegram.sendMessage(
            userId,
            `🎉 *Pembayaran berhasil dikonfirmasi!*\n\n` +
            `Akun kamu telah diupgrade ke plan *${planLabel}*.\n` +
            `Credit baru sudah ditambahkan. Selamat berkreasi!\n\n` +
            `Ketuk /menu untuk mulai.`,
            { parse_mode: 'Markdown' }
          );
        } catch (notifyErr) {
          console.error(`[Webhook] Failed to notify user ${userId}:`, notifyErr.message);
        }
      }

      res.json({ success: true, message: 'Payment processed', userId, plan: txDoc.plan });

    } catch (err) {
      console.error('[Webhook] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ────────────────────────────────────────────────────
  // POST /webhook-notification — MacroDroid Android app
  // ────────────────────────────────────────────────────
  app.post('/webhook-notification', async (req, res) => {
    try {
      const { message, source } = req.body;
      console.log(`[WebhookNotif] Received from ${source}: ${message}`);

      // Extract amount from message (e.g. "Pembayaran Rp 50.127 dari JOHN DOE berhasil")
      const amountMatch = message?.match(/Rp[\s]*([\d.,]+)/);
      if (!amountMatch) {
        return res.json({ success: false, matched: false });
      }

      const amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
      const paidAmount = parseFloat(amountStr);

      // Find pending transaction with matching amount_total
      const pendingTx = await Transaction.findOne({
        status: 'pending',
        amountTotal: paidAmount,
      }).sort({ createdAt: -1 });

      if (!pendingTx) {
        return res.json({ success: false, matched: false, message: 'No matching transaction' });
      }

      // Mark as paid
      pendingTx.status = 'paid';
      pendingTx.paidAt = new Date();
      await pendingTx.save();

      // Upgrade user
      await upgradeUserPlan(pendingTx.userId, pendingTx.plan);

      // Notify user
      if (webhookBot) {
        try {
          const planLabel = pendingTx.plan === 'pro' ? 'Pro' : 'Unlimited';
          await webhookBot.telegram.sendMessage(
            pendingTx.userId,
            `🎉 *Pembayaran diterima!*\n\n` +
            `Akun kamu diupgrade ke *${planLabel}*.\n` +
            `Ketuk /menu untuk mulai.`,
            { parse_mode: 'Markdown' }
          );
        } catch (_) {}
      }

      res.json({
        success: true,
        matched: true,
        transaction_id: pendingTx.transactionId,
      });

    } catch (err) {
      console.error('[WebhookNotif] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Health check ───────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

/**
 * Start the webhook Express server.
 */
function startWebhookServer(bot) {
  setWebhookBot(bot);
  const app = createWebhookServer();
  const port = config.webhook.port;

  app.listen(port, () => {
    console.log(`[Webhook] Server listening on port ${port}`);
    console.log(`[Webhook] Hubify endpoint: POST http://localhost:${port}/webhook/hubify`);
    console.log(`[Webhook] MacroDroid endpoint: POST http://localhost:${port}/webhook-notification`);
  });

  return app;
}

module.exports = { createWebhookServer, startWebhookServer, setWebhookBot };
