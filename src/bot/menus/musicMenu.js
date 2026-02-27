'use strict';

const { Markup } = require('telegraf');

function musicDurationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('15 detik', 'music_dur:15'),
      Markup.button.callback('30 detik', 'music_dur:30'),
      Markup.button.callback('60 detik', 'music_dur:60'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function musicConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Generate!', 'confirm:music'),
      Markup.button.callback('✏️ Edit Prompt', 'edit:prompt'),
    ],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

module.exports = { musicDurationKeyboard, musicConfirmKeyboard };
