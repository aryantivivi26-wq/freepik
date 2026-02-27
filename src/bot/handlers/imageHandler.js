'use strict';

const { imageModelKeyboard, imageRatioKeyboard, imageConfirmKeyboard } = require('../menus/imageMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

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

  const modelLabel = model === 'mystic' ? 'Mystic 2K' : 'Classic Fast';
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

  // Guard against expired session (Redis TTL) — session fields reset to null
  const model = ctx.session.selectedModel;
  const ratio = ctx.session.selectedRatio;
  if (!model || !ratio) {
    ctx.session.step = 'main_menu';
    await ctx.reply('❌ Sesi kamu kadaluarsa. Silakan mulai ulang dari menu.');
    return sendMainMenu(ctx);
  }

  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  const modelLabel = model === 'mystic' ? 'Mystic 2K' : 'Classic Fast';

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

  // Guard against null session values
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

module.exports = { startImageFlow, handleImageModel, handleImageRatio, handleImagePrompt, confirmImageGeneration };
