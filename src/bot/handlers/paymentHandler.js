'use strict';

const QRCode = require('qrcode');
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

    // Generate QR code image from QRIS string
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
        try {
          await ctx.replyWithPhoto(
            { source: qrImageBuffer },
            {
              caption,
              parse_mode: 'Markdown',
              ...paymentCheckKeyboard(txData.transactionId),
            }
          );
        } catch (tgErr) {
          console.error('[Payment] Failed to send QR image:', tgErr.message);
          await ctx.reply(
            `❌ Gagal mengirim gambar QR ke Telegram. Silakan scan manual QRIS berikut di aplikasi e-wallet:
    const txResult = await checkTransactionStatus(transactionId);
            { parse_mode: 'HTML' }
          );
          await ctx.reply(caption, { parse_mode: 'Markdown', ...paymentCheckKeyboard(txData.transactionId) });
        }
      } else {
        // QR gagal total, infokan ke user dan tampilkan QRIS string
        let failMsg = '❌ Gagal generate gambar QR.';
        if (qrError) failMsg += `\nAlasan: ${qrError}`;
        await ctx.reply(
          `${failMsg}\n\nSilakan scan manual QRIS berikut di aplikasi e-wallet:\n<code>${txData.qrisContent || '-tidak ada-'}</code>`,
          { parse_mode: 'HTML' }
        );
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
      // The payment message may be either a text message (editMessageText) or
      // a photo message with caption (editMessageCaption) depending on whether
      // Hubify returned a QR image. Try text first, fall back to caption.
      const expiredText = `⏰ *Transaksi sudah kadaluarsa.*\n\nSilakan buat transaksi baru.`;
      await ctx.editMessageText(expiredText, { parse_mode: 'Markdown' })
        .catch(() =>
          ctx.editMessageCaption(expiredText, { parse_mode: 'Markdown' })
            .catch(() => ctx.reply('⏰ Transaksi sudah kadaluarsa. Silakan buat transaksi baru.'))
        );

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

  // Message may be a photo (QR code) or text — try both edit methods.
  await ctx.editMessageText('❌ Transaksi dibatalkan.')
    .catch(() => ctx.editMessageCaption('❌ Transaksi dibatalkan.').catch(() => {}));
  await sendMainMenu(ctx);
}

module.exports = { showPlans, handleBuyPlan, handleCheckPayment, handleCancelPayment };
