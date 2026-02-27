'use strict';

const { Markup } = require('telegraf');

function planKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Pro — Rp 29.000/bulan', 'buy_plan:pro')],
    [Markup.button.callback('♾️ Unlimited — Rp 79.000/bulan', 'buy_plan:unlimited')],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

function paymentCheckKeyboard(transactionId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Cek Status Pembayaran', `check_payment:${transactionId}`)],
    [Markup.button.callback('❌ Batalkan', `cancel_payment:${transactionId}`)],
  ]);
}

module.exports = { planKeyboard, paymentCheckKeyboard };
