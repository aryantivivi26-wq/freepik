'use strict';

const { musicDurationKeyboard, musicConfirmKeyboard } = require('../menus/musicMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

async function startMusicFlow(ctx) {
  ctx.session.type = 'music';
  ctx.session.step = 'select_duration';
  ctx.session.selectedDuration = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🎵 *Generate Musik AI*\n\nPilih durasi musik:',
    { parse_mode: 'Markdown', ...musicDurationKeyboard() }
  );
}

async function handleMusicDuration(ctx, duration) {
  ctx.session.selectedDuration = duration;
  ctx.session.step = 'awaiting_prompt';

  await ctx.editMessageText(
    `🎵 *Generate Musik AI*\nDurasi: *${duration} detik*\n\n` +
    `✏️ Deskripsikan musik yang ingin kamu buat:\n\n` +
    `_Contoh: "Epic orchestral music with drums and strings, cinematic, intense"_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleMusicPrompt(ctx) {
  const prompt = ctx.message.text;

  // Guard against expired session
  const duration = ctx.session.selectedDuration;
  if (!duration) {
    ctx.session.step = 'main_menu';
    await ctx.reply('❌ Sesi kamu kadaluarsa. Silakan mulai ulang dari menu.');
    return sendMainMenu(ctx);
  }

  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  await ctx.reply(
    `🎵 *Konfirmasi Generate Musik*\n\n` +
    `⏱ Durasi: *${duration} detik*\n` +
    `📝 Prompt:\n\`${prompt}\`\n\n` +
    `Lanjutkan generate?`,
    { parse_mode: 'Markdown', ...musicConfirmKeyboard() }
  );
}

async function confirmMusicGeneration(ctx) {
  const { selectedDuration, prompt } = ctx.session;

  // Guard against null session values
  if (!selectedDuration || !prompt) {
    ctx.session.step = 'main_menu';
    await ctx.editMessageText('❌ Sesi kadaluarsa. Silakan mulai ulang.').catch(() => {});
    return sendMainMenu(ctx);
  }

  ctx.session.step = 'generating';

  await ctx.editMessageText(
    `⏳ *Sedang memproses...*\n\nJob musik kamu sudah masuk antrian.`,
    { parse_mode: 'Markdown' }
  );

  const options = { duration: selectedDuration };
  const jobId = await submitJob(ctx, 'music', prompt, 'music_gen', options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job musik #${jobId.slice(0, 8)} berhasil ditambahkan!*\n\nHasil akan dikirim otomatis setelah selesai.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.session.step = 'main_menu';
  }
}

module.exports = { startMusicFlow, handleMusicDuration, handleMusicPrompt, confirmMusicGeneration };
