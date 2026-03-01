'use strict';

const {
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
} = require('../menus/videoMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

const VIDEO_MODEL_LABELS = {
  kling_pro: 'Kling v3 Pro',
  kling_std: 'Kling v3 Std',
  kling_omni_pro: 'Kling Omni Pro',
  kling_omni_std: 'Kling Omni Std',
  runway: 'Runway Gen 4.5',
  wan: 'Wan 2.5',
  seedance: 'Seedance 1.5 Pro',
};

/* Which ratio keyboard to show per model */
function getRatioKeyboard(model) {
  if (model === 'runway') return videoRatioKeyboard_runway();
  if (model === 'wan') return videoRatioKeyboard_wan();
  if (model === 'seedance') return videoRatioKeyboard_seedance();
  return videoRatioKeyboard_kling(); // kling_pro, kling_std, kling_omni_pro, kling_omni_std
}

/* Which duration keyboard to show per model */
function getDurationKeyboard(model) {
  if (model === 'kling_omni_pro' || model === 'kling_omni_std') return videoDurationKeyboard_kling_omni();
  if (model === 'runway') return videoDurationKeyboard_runway();
  if (model === 'wan') return videoDurationKeyboard_wan();
  if (model === 'seedance') return videoDurationKeyboard_seedance();
  return videoDurationKeyboard_kling(); // kling_pro, kling_std
}

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

  const label = VIDEO_MODEL_LABELS[model] || model;
  await ctx.editMessageText(
    `🎬 *Generate Video AI*\nModel: *${label}*\n\nPilih rasio video:`,
    { parse_mode: 'Markdown', ...getRatioKeyboard(model) }
  );
}

async function handleVideoRatio(ctx, ratio) {
  ctx.session.selectedRatio = ratio;
  ctx.session.step = 'select_duration';

  const model = ctx.session.selectedModel;
  await ctx.editMessageText(
    `🎬 *Generate Video AI*\nRasio: *${ratio}*\n\nPilih durasi video:`,
    { parse_mode: 'Markdown', ...getDurationKeyboard(model) }
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

  const { selectedModel, selectedRatio, selectedDuration } = ctx.session;
  if (!selectedModel || !selectedRatio || !selectedDuration) {
    ctx.session.step = 'main_menu';
    await ctx.reply('❌ Sesi kamu kadaluarsa. Silakan mulai ulang dari menu.');
    return sendMainMenu(ctx);
  }

  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  const label = VIDEO_MODEL_LABELS[selectedModel] || selectedModel;

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

  if (!selectedModel || !selectedRatio || !selectedDuration || !prompt) {
    ctx.session.step = 'main_menu';
    await ctx.editMessageText('❌ Sesi kadaluarsa. Silakan mulai ulang.').catch(() => {});
    return sendMainMenu(ctx);
  }

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

module.exports = { startVideoFlow, handleVideoModel, handleVideoRatio, handleVideoDuration, handleVideoPrompt, confirmVideoGeneration, VIDEO_MODEL_LABELS };
