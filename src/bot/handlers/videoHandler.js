'use strict';

const { videoModelKeyboard, videoRatioKeyboard, videoDurationKeyboard, videoConfirmKeyboard } = require('../menus/videoMenu');
const { submitJob } = require('./jobHandler');

async function startVideoFlow(ctx) {
  ctx.session.type = 'video';
  ctx.session.step = 'select_model';
  ctx.session.selectedModel = null;
  ctx.session.selectedRatio = null;
  ctx.session.selectedDuration = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🎬 *Generate Video AI*\n\nPilih model yang ingin kamu gunakan:',
    { parse_mode: 'Markdown', ...videoModelKeyboard() }
  );
}

async function handleVideoModel(ctx, model) {
  ctx.session.selectedModel = model;
  ctx.session.step = 'select_ratio';

  const label = model === 'kling_pro' ? 'Kling v3 Pro' : 'Kling v3 Std';
  await ctx.editMessageText(
    `🎬 *Generate Video AI*\nModel: *${label}*\n\nPilih rasio video:`,
    { parse_mode: 'Markdown', ...videoRatioKeyboard() }
  );
}

async function handleVideoRatio(ctx, ratio) {
  ctx.session.selectedRatio = ratio;
  ctx.session.step = 'select_duration';

  await ctx.editMessageText(
    `🎬 *Generate Video AI*\nRasio: *${ratio}*\n\nPilih durasi video:`,
    { parse_mode: 'Markdown', ...videoDurationKeyboard() }
  );
}

async function handleVideoDuration(ctx, duration) {
  ctx.session.selectedDuration = duration;
  ctx.session.step = 'awaiting_prompt';

  await ctx.editMessageText(
    `🎬 *Generate Video AI*\nDurasi: *${duration} detik*\n\n` +
    `✏️ Sekarang kirim *prompt* video yang ingin kamu buat:\n\n` +
    `_Contoh: "A dragon flying over a medieval castle at night"_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleVideoPrompt(ctx) {
  const prompt = ctx.message.text;
  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  const { selectedModel, selectedRatio, selectedDuration } = ctx.session;
  const label = selectedModel === 'kling_pro' ? 'Kling v3 Pro' : 'Kling v3 Std';

  await ctx.reply(
    `🎬 *Konfirmasi Generate Video*\n\n` +
    `📌 Model: *${label}*\n` +
    `📺 Rasio: *${selectedRatio}*\n` +
    `⏱ Durasi: *${selectedDuration} detik*\n` +
    `📝 Prompt:\n\`${prompt}\`\n\n` +
    `Lanjutkan generate?`,
    { parse_mode: 'Markdown', ...videoConfirmKeyboard() }
  );
}

async function confirmVideoGeneration(ctx) {
  const { selectedModel, selectedRatio, selectedDuration, prompt } = ctx.session;
  ctx.session.step = 'generating';

  await ctx.editMessageText(
    `⏳ *Sedang memproses...*\n\nJob video kamu sudah masuk antrian.`,
    { parse_mode: 'Markdown' }
  );

  const options = { aspectRatio: selectedRatio, duration: selectedDuration };
  const jobId = await submitJob(ctx, 'video', prompt, selectedModel, options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job video #${jobId.slice(0, 8)} berhasil ditambahkan!*\n\nProses video membutuhkan beberapa menit. Kamu akan menerima hasilnya otomatis.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.session.step = 'main_menu';
  }
}

module.exports = { startVideoFlow, handleVideoModel, handleVideoRatio, handleVideoDuration, handleVideoPrompt, confirmVideoGeneration };
