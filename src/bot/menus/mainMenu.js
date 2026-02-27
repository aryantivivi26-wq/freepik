'use strict';

const { Markup } = require('telegraf');

function mainMenuKeyboard() {
  return Markup.keyboard([
    ['🖼 Generate Gambar', '🎬 Generate Video'],
    ['🎵 Generate Musik', '🔊 Text-to-Speech'],
    ['👤 Profil Saya', '💎 Upgrade Plan'],
    ['❓ Bantuan'],
  ])
    .resize()
    .persistent();
}

async function sendMainMenu(ctx, text) {
  const msg = text || '🏠 *Menu Utama*\n\nPilih layanan yang ingin kamu gunakan:';
  return ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
}

module.exports = { mainMenuKeyboard, sendMainMenu };
