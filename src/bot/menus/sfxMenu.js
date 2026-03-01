'use strict';

const { Markup } = require('telegraf');

function sfxDurationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('5 detik', 'sfx_dur:5'),
      Markup.button.callback('10 detik', 'sfx_dur:10'),
    ],
    [
      Markup.button.callback('15 detik', 'sfx_dur:15'),
      Markup.button.callback('22 detik', 'sfx_dur:22'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function sfxConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Generate!', 'confirm:sfx'),
      Markup.button.callback('✏️ Edit Prompt', 'edit:prompt'),
    ],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

module.exports = { sfxDurationKeyboard, sfxConfirmKeyboard };
