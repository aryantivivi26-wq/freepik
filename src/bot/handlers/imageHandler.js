'use strict';

const { imageModelKeyboard, imageRatioKeyboard, imageConfirmKeyboard } = require('../menus/imageMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

const IMAGE_MODEL_LABELS = {
  classic_fast: 'Classic Fast',
  mystic: 'Mystic 2K',
  flux_dev: 'Flux Dev',
  flux_2_pro: 'Flux 2 Pro',
  flux_2_klein: 'Flux 2 Klein',
  flux_kontext: 'Flux Kontext Pro',
  hyperflux: 'HyperFlux',
  seedream: 'Seedream v4.5',
  seedream_v5: 'Seedream v5 Lite',
  z_image: 'Z-Image',
};

async function startImageFlow(ctx) {
  ctx.session.type = 'image';
  ctx.session.step = 'select_model';
  ctx.session.selectedModel = null;
  ctx.session.selectedRatio = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🖼 *Generate Gambar AI*\n\nPilih model yang ingin kamu gunakan:',
    { parse_mode: 'Markdown', ...imageModelKeyboard() }
  );
}

async function handleImageModel(ctx, model) {
  ctx.session.selectedModel = model;
  ctx.session.step = 'select_ratio';

  const modelLabel = IMAGE_MODEL_LABELS[model] || model;
  await ctx.editMessageText(
    `🖼 *Generate Gambar AI*\nModel: *${modelLabel}*\n\nPilih ukuran/rasio gambar:`,
    { parse_mode: 'Markdown', ...imageRatioKeyboard() }
  );
}

async function handleImageRatio(ctx, ratio) {
  ctx.session.selectedRatio = ratio;
  ctx.session.step = 'awaiting_prompt';

  await ctx.editMessageText(
    `🖼 *Generate Gambar AI*\n\nPilih rasio: *${ratio.replace(/_/g, ' ')}*\n\n` +
    `✏️ Sekarang kirim *prompt* gambar yang ingin kamu buat:\n\n` +
    `_Contoh: "A futuristic city at sunset with flying cars, photorealistic"_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleImagePrompt(ctx) {
  const prompt = ctx.message.text;

  const model = ctx.session.selectedModel;
  const ratio = ctx.session.selectedRatio;
  if (!model || !ratio) {
    ctx.session.step = 'main_menu';
    await ctx.reply('❌ Sesi kamu kadaluarsa. Silakan mulai ulang dari menu.');
    return sendMainMenu(ctx);
  }

  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  const modelLabel = IMAGE_MODEL_LABELS[model] || model;

  await ctx.reply(
    `🖼 *Konfirmasi Generate Gambar*\n\n` +
    `📌 Model: *${modelLabel}*\n` +
    `📐 Ukuran: *${ratio.replace(/_/g, ' ')}*\n` +
    `📝 Prompt:\n\`${prompt}\`\n\n` +
    `Lanjutkan generate?`,
    { parse_mode: 'Markdown', ...imageConfirmKeyboard() }
  );
}

async function confirmImageGeneration(ctx) {
  const { selectedModel, selectedRatio, prompt } = ctx.session;

  if (!selectedModel || !selectedRatio || !prompt) {
    ctx.session.step = 'main_menu';
    await ctx.editMessageText('❌ Sesi kadaluarsa. Silakan mulai ulang.').catch(() => {});
    return sendMainMenu(ctx);
  }

  ctx.session.step = 'generating';

  await ctx.editMessageText(
    `⏳ *Sedang memproses...*\n\nJob kamu sudah masuk antrian. Hasil akan dikirim otomatis setelah selesai.`,
    { parse_mode: 'Markdown' }
  );

  const options = { size: selectedRatio };
  const jobId = await submitJob(ctx, 'image', prompt, selectedModel, options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job #${jobId.slice(0, 8)} berhasil ditambahkan ke antrian!*\n\n` +
      `Kamu akan menerima hasilnya sebentar lagi.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.session.step = 'main_menu';
  }
}

module.exports = { startImageFlow, handleImageModel, handleImageRatio, handleImagePrompt, confirmImageGeneration, IMAGE_MODEL_LABELS };
