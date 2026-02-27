'use strict';

const { Markup } = require('telegraf');

function imageModelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚡ Classic Fast (Sync)', 'img_model:classic_fast'),
      Markup.button.callback('✨ Mystic 2K (Async)', 'img_model:mystic'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function imageRatioKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1:1 Square', 'img_ratio:square_1_1'),
      Markup.button.callback('3:4 Portrait', 'img_ratio:portrait_3_4'),
    ],
    [
      Markup.button.callback('4:3 Landscape', 'img_ratio:landscape_4_3'),
      Markup.button.callback('9:16 Story', 'img_ratio:portrait_9_16'),
    ],
    [Markup.button.callback('16:9 Widescreen', 'img_ratio:landscape_16_9')],
    [Markup.button.callback('↩️ Kembali', 'back:image_model')],
  ]);
}

function imageConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Generate!', 'confirm:image'),
      Markup.button.callback('✏️ Edit Prompt', 'edit:prompt'),
    ],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

module.exports = { imageModelKeyboard, imageRatioKeyboard, imageConfirmKeyboard };
