'use strict';

const QRCode = require('qrcode');
const { planKeyboard, paymentCheckKeyboard } = require('../menus/paymentMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { createTransaction, checkTransactionStatus } = require('../../services/hubify');
const { upgradeUserPlan } = require('../../utils/userHelper');
const { Transaction } = require('../../models');
const config = require('../../config');

// ── QRIS Auto-Expiry Timer Map ─────────────────────
// key: transactionId, value: { timer, chatId, messageId }
const activeQrisTimers = new Map();

const QRIS_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Start a 15-minute auto-expiry timer for a QRIS transaction.
 * When it fires, it deletes the QR message, marks the transaction as expired.
 */
function startExpiryTimer(telegram, transactionId, chatId, messageId) {
  // Clear any existing timer for this transaction
  clearExpiryTimer(transactionId);

  const timer = setTimeout(async () => {
    activeQrisTimers.delete(transactionId);
    try {
      // Check if the transaction is still pending before expiring
      const txDoc = await Transaction.findOne({ transactionId });
      if (!txDoc || txDoc.status !== 'pending') return; // already paid/cancelled

      // Mark as expired in DB
      txDoc.status = 'expired';
      await txDoc.save();

      // Try to delete the QR message
      await telegram.deleteMessage(chatId, messageId).catch(() => {});

      // Notify user
      await telegram.sendMessage(
        chatId,
        `⏰ *Transaksi QRIS kadaluarsa*\n\n` +
        `Transaction ID: \`${transactionId}\`\n\n` +
        `QR code telah dihapus. Silakan buat transaksi baru jika masih ingin upgrade.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error(`[Payment] Auto-expiry error for ${transactionId}:`, err.message);
    }
  }, QRIS_EXPIRY_MS);

  activeQrisTimers.set(transactionId, { timer, chatId, messageId });
}

/**
 * Clear an active expiry timer (e.g., when payment confirmed or cancelled).
 */
function clearExpiryTimer(transactionId) {
  const entry = activeQrisTimers.get(transactionId);
  if (entry) {
    clearTimeout(entry.timer);
    activeQrisTimers.delete(transactionId);
  }
}

/**
 * Delete the QR message for a transaction (on payment confirm or expiry).
 */
async function deleteQrisMessage(telegram, transactionId) {
  const entry = activeQrisTimers.get(transactionId);
  if (entry) {
    await telegram.deleteMessage(entry.chatId, entry.messageId).catch(() => {});
    clearExpiryTimer(transactionId);
  }
}

// ─────────────────────────────────────────

async function showPlans(ctx) {
  ctx.session.step = 'select_plan';
  const user = ctx.state.user;

  const planInfo =
    `💎 *Upgrade Plan*\n\n` +
    `Plan saat ini: *${user.plan.toUpperCase()}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 *PRO — Rp 29.000/bulan*\n` +
    `• 50 Gambar | 20 Video\n` +
    `• 30 Musik | 50 SFX | 100 TTS\n\n` +
    `♾️ *UNLIMITED — Rp 79.000/bulan*\n` +
    `• 9999 semua kategori\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih plan yang kamu inginkan:`;

  await ctx.reply(planInfo, { parse_mode: 'Markdown', ...planKeyboard() });
}

async function handleBuyPlan(ctx, plan) {
  const userId = ctx.from.id;
  ctx.session.step = 'awaiting_payment';
  ctx.session.pendingPlan = plan;

  await ctx.editMessageText('⏳ Membuat transaksi QRIS...', { parse_mode: 'Markdown' });

  try {
    const txData = await createTransaction(userId, plan);
    ctx.session.pendingTransactionId = txData.transactionId;

    // Generate QR code image from QRIS string
    let qrImageBuffer = null;
    let qrError = null;
    if (!txData.qrisContent || typeof txData.qrisContent !== 'string' || txData.qrisContent.length < 10) {
      qrError = 'QRIS string kosong atau tidak valid dari Hubify.';
      console.error('[Payment] qrisContent missing or invalid:', txData.qrisContent);
    } else {
      try {
        qrImageBuffer = await QRCode.toBuffer(txData.qrisContent, {
          type: 'png',
          width: 512,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrErr) {
        qrError = qrErr.message;
        console.error('[Payment] QR generation error:', qrErr.message);
      }
    }

    // Fallback: try base64 image URL from Hubify if QR generation failed
    if (!qrImageBuffer && txData.qrisImageUrl && txData.qrisImageUrl.startsWith('data:image')) {
      const base64Data = txData.qrisImageUrl.split(',')[1];
      if (base64Data) qrImageBuffer = Buffer.from(base64Data, 'base64');
    }

    const planLabel = plan === 'pro' ? 'Pro' : 'Unlimited';

    const caption =
      `💳 *Pembayaran QRIS — ${planLabel}*\n\n` +
      `📋 Order ID: \`${txData.orderId}\`\n` +
      `🆔 Transaction ID: \`${txData.transactionId}\`\n\n` +
      `💰 Harga asli: Rp ${txData.amountOriginal.toLocaleString('id-ID')}\n` +
      `🔢 Unique code: +${txData.amountUnique}\n` +
      `⚠️ *Transfer TEPAT: Rp ${txData.amountTotal.toLocaleString('id-ID')}*\n\n` +
      `⏰ Berlaku: *15 menit* (otomatis expired)\n\n` +
      `_Scan QR di atas, lalu transfer TEPAT sesuai nominal._`;

    if (qrImageBuffer) {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id).catch(() => {});
      try {
        const sentMsg = await ctx.replyWithPhoto(
          { source: qrImageBuffer },
          {
            caption,
            parse_mode: 'Markdown',
            ...paymentCheckKeyboard(txData.transactionId),
          }
        );

        // Start 15-minute auto-expiry timer
        startExpiryTimer(ctx.telegram, txData.transactionId, ctx.chat.id, sentMsg.message_id);
      } catch (tgErr) {
        console.error('[Payment] Failed to send QR image:', tgErr.message);
        await ctx.reply(
          '❌ Gagal mengirim gambar QR ke Telegram. Silakan scan manual QRIS berikut di aplikasi e-wallet:\n<code>' + (txData.qrisContent || '-tidak ada-') + '</code>',
          { parse_mode: 'HTML' }
        );
        const sentMsg = await ctx.reply(caption, { parse_mode: 'Markdown', ...paymentCheckKeyboard(txData.transactionId) });
        startExpiryTimer(ctx.telegram, txData.transactionId, ctx.chat.id, sentMsg.message_id);
      }
    } else {
      let failMsg = '❌ Gagal generate gambar QR.';
      if (qrError) failMsg += '\nAlasan: ' + qrError;
      await ctx.reply(
        failMsg + '\n\nSilakan scan manual QRIS berikut di aplikasi e-wallet:\n<code>' + (txData.qrisContent || '-tidak ada-') + '</code>',
        { parse_mode: 'HTML' }
      );
      const sentMsg = await ctx.editMessageText(caption, {
        parse_mode: 'Markdown',
        ...paymentCheckKeyboard(txData.transactionId),
      });
      if (sentMsg && sentMsg.message_id) {
        startExpiryTimer(ctx.telegram, txData.transactionId, ctx.chat.id, sentMsg.message_id);
      }
    }
  } catch (err) {
    console.error('[Payment] createTransaction error:', err.message);
    await ctx.editMessageText(
      `❌ Gagal membuat transaksi: ${err.message}\n\nCoba lagi nanti.`,
      { parse_mode: 'Markdown' }
    );
    ctx.session.step = 'main_menu';
  }
}

async function handleCheckPayment(ctx, transactionId) {
  try {
    const txResult = await checkTransactionStatus(transactionId);

    if (txResult.status === 'paid') {
      const txDoc = await Transaction.findOne({ transactionId });
      if (!txDoc) throw new Error('Transaction not found in DB');

      if (txDoc.status === 'paid') {
        await ctx.reply('✅ Pembayaran sudah diproses sebelumnya! Akun kamu sudah diupgrade.');
        ctx.session.step = 'main_menu';
        return;
      }

      // Mark as paid and upgrade
      txDoc.status = 'paid';
      txDoc.paidAt = txResult.paid_at ? new Date(txResult.paid_at) : new Date();
      await txDoc.save();

      await upgradeUserPlan(ctx.from.id, txDoc.plan);

      // Clear timer and delete QR message
      await deleteQrisMessage(ctx.telegram, transactionId);

      ctx.session.step = 'main_menu';
      ctx.session.pendingTransactionId = null;

      const planLabel = txDoc.plan === 'pro' ? 'Pro' : 'Unlimited';
      await ctx.reply(
        `🎉 *Pembayaran berhasil!*\n\n` +
        `Akun kamu telah diupgrade ke plan *${planLabel}*.\n` +
        `Credit sudah ditambahkan. Selamat berkreasi!`,
        { parse_mode: 'Markdown' }
      );
      await sendMainMenu(ctx);

    } else if (txResult.status === 'expired') {
      // Clear timer and delete QR message
      await deleteQrisMessage(ctx.telegram, transactionId);

      ctx.session.step = 'main_menu';
      ctx.session.pendingTransactionId = null;
      await ctx.reply('⏰ Transaksi sudah kadaluarsa. Silakan buat transaksi baru.');

    } else {
      // Still pending
      await ctx.reply(
        `⏳ *Pembayaran belum diterima.*\n\nPastikan kamu sudah transfer TEPAT sesuai nominal. ` +
        `Cek lagi dalam beberapa menit.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[Payment] checkPayment error:', err.message);
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

async function handleCancelPayment(ctx, transactionId) {
  await ctx.answerCbQuery('❌ Transaksi dibatalkan');

  try {
    await Transaction.findOneAndUpdate({ transactionId }, { status: 'cancelled' });
  } catch (_) {}

  // Clear timer and delete QR message
  await deleteQrisMessage(ctx.telegram, transactionId);

  ctx.session.step = 'main_menu';
  ctx.session.pendingTransactionId = null;
  ctx.session.pendingPlan = null;

  await ctx.reply('❌ Transaksi dibatalkan.');
  await sendMainMenu(ctx);
}

module.exports = { showPlans, handleBuyPlan, handleCheckPayment, handleCancelPayment };
