'use strict';

const { Markup } = require('telegraf');

function imageEditToolKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔍 Upscale (HD)', 'imgedit:upscale')],
    [Markup.button.callback('✂️ Remove Background', 'imgedit:removebg')],
    [Markup.button.callback('🎨 Reimagine (AI)', 'imgedit:reimagine')],
    [Markup.button.callback('💡 Relight', 'imgedit:relight')],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function upscaleFactorKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('2x', 'imgedit_scale:2'),
      Markup.button.callback('4x', 'imgedit_scale:4'),
    ],
    [Markup.button.callback('↩️ Kembali', 'imgedit:back_tool')],
  ]);
}

function imageEditConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Proses!', 'confirm:imgedit'),
      Markup.button.callback('❌ Batal', 'back:main'),
    ],
  ]);
}

module.exports = { imageEditToolKeyboard, upscaleFactorKeyboard, imageEditConfirmKeyboard };
