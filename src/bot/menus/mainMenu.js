'use strict';

const { Markup } = require('telegraf');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🖼 Generate Gambar', 'menu:image'),
      Markup.button.callback('🎬 Generate Video', 'menu:video'),
    ],
    [
      Markup.button.callback('🎵 Generate Musik', 'menu:music'),
      Markup.button.callback('🔊 Sound Effects', 'menu:sfx'),
    ],
    [
      Markup.button.callback('🗣 Text-to-Speech', 'menu:tts'),
      Markup.button.callback('👤 Profil Saya', 'menu:profile'),
    ],
    [
      Markup.button.callback('💎 Upgrade Plan', 'menu:upgrade'),
      Markup.button.callback('❓ Bantuan', 'menu:help'),
    ],
  ]);
}

async function sendMainMenu(ctx, text) {
  const msg = text || '🏠 *Menu Utama*\n\nPilih layanan yang ingin kamu gunakan:';
  return ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
}

module.exports = { mainMenuKeyboard, sendMainMenu };
