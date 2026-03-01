'use strict';

const { Markup } = require('telegraf');
const config = require('../../config');

function mainMenuKeyboard(userId) {
  const buttons = [
    [Markup.button.callback('🎨  Image Generator', 'menu:image')],
    [Markup.button.callback('🖌  Image Editing', 'menu:image_edit')],
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
  ];

  // Show admin panel button only for admin
  if (userId && Number(userId) === Number(config.bot.adminId)) {
    buttons.push([Markup.button.callback('🛡  Admin Panel', 'admin:menu')]);
  }

  return Markup.inlineKeyboard(buttons);
}

async function sendMainMenu(ctx, text) {
  const msg = text || '✦ *Hubify Studio*\n\nPilih layanan:';
  const userId = ctx.from?.id;
  return ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(userId),
  });
}

module.exports = { mainMenuKeyboard, sendMainMenu };
