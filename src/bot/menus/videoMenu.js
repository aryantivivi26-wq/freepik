'use strict';

const { Markup } = require('telegraf');

function videoModelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🚀 Kling v3 Pro', 'vid_model:kling_pro'),
      Markup.button.callback('💡 Kling v3 Std', 'vid_model:kling_std'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function videoRatioKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('16:9 Landscape', 'vid_ratio:16:9'),
      Markup.button.callback('9:16 Portrait', 'vid_ratio:9:16'),
    ],
    [Markup.button.callback('1:1 Square', 'vid_ratio:1:1')],
    [Markup.button.callback('↩️ Kembali', 'back:video_model')],
  ]);
}

function videoDurationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'vid_dur:5'),
      Markup.button.callback('10 detik', 'vid_dur:10'),
      Markup.button.callback('15 detik', 'vid_dur:15'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_ratio')],
  ]);
}

function videoConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Generate!', 'confirm:video'),
      Markup.button.callback('✏️ Edit Prompt', 'edit:prompt'),
    ],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

module.exports = { videoModelKeyboard, videoRatioKeyboard, videoDurationKeyboard, videoConfirmKeyboard };
