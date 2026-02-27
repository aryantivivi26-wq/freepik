'use strict';

const { ttsVoiceKeyboard, ttsConfirmKeyboard } = require('../menus/ttsMenu');
const { submitJob } = require('./jobHandler');

const VOICE_LABELS = {
  rachel: 'Rachel',
  domi:   'Domi',
  bella:  'Bella',
};

async function startTTSFlow(ctx) {
  ctx.session.type = 'tts';
  ctx.session.step = 'select_voice';
  ctx.session.selectedVoice = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🔊 *Text-to-Speech AI*\n\nPilih suara yang ingin digunakan:',
    { parse_mode: 'Markdown', ...ttsVoiceKeyboard() }
  );
}

async function handleTTSVoice(ctx, voice) {
  ctx.session.selectedVoice = voice;
  ctx.session.step = 'awaiting_prompt';

  const voiceLabel = VOICE_LABELS[voice] || voice;
  await ctx.editMessageText(
    `🔊 *Text-to-Speech AI*\nSuara: *${voiceLabel}*\n\n` +
    `✏️ Kirim teks yang ingin diubah menjadi suara:\n\n` +
    `_Maksimal 5000 karakter_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleTTSPrompt(ctx) {
  const text = ctx.message.text;

  if (text.length > 5000) {
    return ctx.reply('❌ Teks terlalu panjang. Maksimal 5000 karakter.');
  }

  ctx.session.prompt = text;
  ctx.session.step = 'confirming';

  const voiceLabel = VOICE_LABELS[ctx.session.selectedVoice] || ctx.session.selectedVoice;
  const preview = text.length > 100 ? text.slice(0, 100) + '...' : text;

  await ctx.reply(
    `🔊 *Konfirmasi Text-to-Speech*\n\n` +
    `🎙 Suara: *${voiceLabel}*\n` +
    `📝 Teks:\n\`${preview}\`\n\n` +
    `Lanjutkan generate?`,
    { parse_mode: 'Markdown', ...ttsConfirmKeyboard() }
  );
}

async function confirmTTSGeneration(ctx) {
  const { selectedVoice, prompt } = ctx.session;
  ctx.session.step = 'generating';

  await ctx.editMessageText(
    `⏳ *Sedang memproses TTS...*\n\nJob kamu sudah masuk antrian.`,
    { parse_mode: 'Markdown' }
  );

  const options = { voice: selectedVoice };
  const jobId = await submitJob(ctx, 'tts', prompt, 'tts_gen', options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job TTS #${jobId.slice(0, 8)} berhasil ditambahkan!*\n\nAudio akan dikirim otomatis setelah selesai.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.session.step = 'main_menu';
  }
}

module.exports = { startTTSFlow, handleTTSVoice, handleTTSPrompt, confirmTTSGeneration };
