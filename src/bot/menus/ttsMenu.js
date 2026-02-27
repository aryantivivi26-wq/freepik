'use strict';

const { Markup } = require('telegraf');

function ttsVoiceKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👩 Rachel', 'tts_voice:rachel'),
      Markup.button.callback('👩 Domi',   'tts_voice:domi'),
      Markup.button.callback('👩 Bella',  'tts_voice:bella'),
    ],
    [Markup.button.callback('↩️ Kembali', 'back:main')],
  ]);
}

function ttsConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Generate!', 'confirm:tts'),
      Markup.button.callback('✏️ Edit Teks', 'edit:prompt'),
    ],
    [Markup.button.callback('❌ Batal', 'back:main')],
  ]);
}

module.exports = { ttsVoiceKeyboard, ttsConfirmKeyboard };
