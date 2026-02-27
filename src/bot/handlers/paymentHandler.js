'use strict';

const { planKeyboard, paymentCheckKeyboard } = require('../menus/paymentMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { createTransaction, checkTransactionStatus } = require('../../services/hubify');
const { upgradeUserPlan } = require('../../utils/userHelper');
const { Transaction } = require('../../models');
const config = require('../../config');

async function showPlans(ctx) {
  ctx.session.step = 'select_plan';
  const user = ctx.state.user;

  const planInfo =
    `💎 *Upgrade Plan*\n\n` +
    `Plan saat ini: *${user.plan.toUpperCase()}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 *PRO — Rp 29.000/bulan*\n` +
    `• 50 Gambar | 20 Video\n` +
    `• 30 Musik | 100 TTS\n\n` +
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

    // Build base64 QR image if available
    let qrImageBuffer = null;
    if (txData.qrisImageUrl && txData.qrisImageUrl.startsWith('data:image')) {
      const base64Data = txData.qrisImageUrl.split(',')[1];
      if (base64Data) qrImageBuffer = Buffer.from(base64Data, 'base64');
    }

    const planLabel = plan === 'pro' ? 'Pro' : 'Unlimited';
    const expiresStr = txData.expiresAt
      ? new Date(txData.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '15 menit';

    const caption =
      `💳 *Pembayaran QRIS — ${planLabel}*\n\n` +
      `📋 Order ID: \`${txData.orderId}\`\n` +
      `🆔 Transaction ID: \`${txData.transactionId}\`\n\n` +
      `💰 Harga asli: Rp ${txData.amountOriginal.toLocaleString('id-ID')}\n` +
      `🔢 Unique code: +${txData.amountUnique}\n` +
      `⚠️ *Transfer TEPAT: Rp ${txData.amountTotal.toLocaleString('id-ID')}*\n\n` +
      `⏰ Berlaku hingga: ${expiresStr}\n\n` +
      `_Scan QR di atas, lalu transfer TEPAT sesuai nominal._`;

    if (qrImageBuffer) {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id).catch(() => {});
      await ctx.replyWithPhoto(
        { source: qrImageBuffer },
        {
          caption,
          parse_mode: 'Markdown',
          ...paymentCheckKeyboard(txData.transactionId),
        }
      );
    } else {
      await ctx.editMessageText(caption, {
        parse_mode: 'Markdown',
        ...paymentCheckKeyboard(txData.transactionId),
      });
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
  await ctx.answerCbQuery('🔄 Mengecek status pembayaran...');

  try {
    const txResult = await checkTransactionStatus(transactionId);

    if (txResult.status === 'paid') {
      // Get plan from DB record
      const txDoc = await Transaction.findOne({ transactionId });
      if (!txDoc) throw new Error('Transaction not found in DB');

      if (txDoc.status === 'paid') {
        // Already processed
        await ctx.reply('✅ Pembayaran sudah diproses sebelumnya! Akun kamu sudah diupgrade.');
        ctx.session.step = 'main_menu';
        return;
      }

      // Mark as paid and upgrade
      txDoc.status = 'paid';
      txDoc.paidAt = txResult.paid_at ? new Date(txResult.paid_at) : new Date();
      await txDoc.save();

      await upgradeUserPlan(ctx.from.id, txDoc.plan);

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
      ctx.session.step = 'main_menu';
      ctx.session.pendingTransactionId = null;
      await ctx.editMessageCaption(
        `⏰ *Transaksi sudah kadaluarsa.*\n\nSilakan buat transaksi baru.`,
        { parse_mode: 'Markdown' }
      ).catch(() => ctx.reply('⏰ Transaksi sudah kadaluarsa. Silakan buat transaksi baru.'));

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

  ctx.session.step = 'main_menu';
  ctx.session.pendingTransactionId = null;
  ctx.session.pendingPlan = null;

  await ctx.editMessageText('❌ Transaksi dibatalkan.').catch(() => {});
  await sendMainMenu(ctx);
}

module.exports = { showPlans, handleBuyPlan, handleCheckPayment, handleCancelPayment };
