'use strict';

const { Markup } = require('telegraf');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎨  Image Generator', 'menu:image')],
    [Markup.button.callback('🎬  Video Generator', 'menu:video')],
    [
      Markup.button.callback('🎵  Music', 'menu:music'),
      Markup.button.callback('🎧  SFX', 'menu:sfx'),
      Markup.button.callback('🔊  TTS', 'menu:tts'),
    ],
    [
      Markup.button.callback('👤  Profil', 'menu:profile'),
      Markup.button.callback('💎  Upgrade', 'menu:upgrade'),
    ],
    [Markup.button.callback('ℹ️  Help', 'menu:help')],
  ]);
}

async function sendMainMenu(ctx, text) {
  const msg = text || '✦ *Hubify Studio*\n\nPilih layanan:';
  return ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
}

module.exports = { mainMenuKeyboard, sendMainMenu };
