'use strict';

const { Markup } = require('telegraf');

function videoModelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎬 Kling v3 Pro', 'vid_model:kling_pro'),
      Markup.button.callback('🎥 Kling v3 Std', 'vid_model:kling_std'),
    ],
    [
      Markup.button.callback('🌐 Kling Omni Pro', 'vid_model:kling_omni_pro'),
      Markup.button.callback('🌐 Kling Omni Std', 'vid_model:kling_omni_std'),
    ],
    [
      Markup.button.callback('✈️ Runway Gen 4.5', 'vid_model:runway'),
      Markup.button.callback('🌊 Wan 2.5', 'vid_model:wan'),
    ],
    [
      Markup.button.callback('💃 Seedance 1.5', 'vid_model:seedance'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

/* Ratio keyboards per model family */

function videoRatioKeyboard_kling() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('16:9', 'vid_ratio:16:9'),
      Markup.button.callback('9:16', 'vid_ratio:9:16'),
      Markup.button.callback('1:1', 'vid_ratio:1:1'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_model')],
  ]);
}

function videoRatioKeyboard_runway() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1280:720', 'vid_ratio:1280:720'),
      Markup.button.callback('720:1280', 'vid_ratio:720:1280'),
    ],
    [
      Markup.button.callback('960:960', 'vid_ratio:960:960'),
      Markup.button.callback('1104:832', 'vid_ratio:1104:832'),
    ],
    [
      Markup.button.callback('832:1104', 'vid_ratio:832:1104'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_model')],
  ]);
}

function videoRatioKeyboard_wan() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('16:9', 'vid_ratio:16:9'),
      Markup.button.callback('9:16', 'vid_ratio:9:16'),
      Markup.button.callback('1:1', 'vid_ratio:1:1'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_model')],
  ]);
}

function videoRatioKeyboard_seedance() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('16:9', 'vid_ratio:16:9'),
      Markup.button.callback('9:16', 'vid_ratio:9:16'),
      Markup.button.callback('1:1', 'vid_ratio:1:1'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_model')],
  ]);
}

function videoDurationKeyboard_kling() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'vid_dur:5'),
      Markup.button.callback('10 detik', 'vid_dur:10'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_ratio')],
  ]);
}

function videoDurationKeyboard_kling_omni() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('3 detik', 'vid_dur:3'),
      Markup.button.callback('5 detik', 'vid_dur:5'),
      Markup.button.callback('10 detik', 'vid_dur:10'),
    ],
    [
      Markup.button.callback('15 detik', 'vid_dur:15'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_ratio')],
  ]);
}

function videoDurationKeyboard_runway() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'vid_dur:5'),
      Markup.button.callback('8 detik', 'vid_dur:8'),
      Markup.button.callback('10 detik', 'vid_dur:10'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_ratio')],
  ]);
}

function videoDurationKeyboard_wan() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'vid_dur:5'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:video_ratio')],
  ]);
}

function videoDurationKeyboard_seedance() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'vid_dur:5'),
      Markup.button.callback('10 detik', 'vid_dur:10'),
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

module.exports = {
  videoModelKeyboard,
  videoRatioKeyboard_kling,
  videoRatioKeyboard_runway,
  videoRatioKeyboard_wan,
  videoRatioKeyboard_seedance,
  videoDurationKeyboard_kling,
  videoDurationKeyboard_kling_omni,
  videoDurationKeyboard_runway,
  videoDurationKeyboard_wan,
  videoDurationKeyboard_seedance,
  videoConfirmKeyboard,
};
