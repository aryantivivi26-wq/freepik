'use strict';

const { Markup } = require('telegraf');

function imageModelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚡ Classic Fast', 'img_model:classic_fast'),
      Markup.button.callback('✨ Mystic 2K', 'img_model:mystic'),
    ],
    [
      Markup.button.callback('🔮 Flux Dev', 'img_model:flux_dev'),
      Markup.button.callback('💎 Flux 2 Pro', 'img_model:flux_2_pro'),
    ],
    [
      Markup.button.callback('⚡ Flux 2 Klein', 'img_model:flux_2_klein'),
      Markup.button.callback('🎯 Flux Kontext', 'img_model:flux_kontext'),
    ],
    [
      Markup.button.callback('🌀 HyperFlux', 'img_model:hyperflux'),
      Markup.button.callback('🌱 Seedream 4.5', 'img_model:seedream'),
    ],
    [
      Markup.button.callback('🌿 Seedream v5', 'img_model:seedream_v5'),
      Markup.button.callback('🖼 Z-Image', 'img_model:z_image'),
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
