'use strict';

const { imageEditToolKeyboard, upscaleFactorKeyboard, imageEditConfirmKeyboard } = require('../menus/imageEditMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

const TOOL_LABELS = {
  upscale: '🔍 Upscale (HD)',
  removebg: '✂️ Remove Background',
  reimagine: '🎨 Reimagine (AI)',
  relight: '💡 Relight',
};

// ── Start image editing flow ──────────────────────

async function startImageEditFlow(ctx) {
  ctx.session.type = 'image_edit';
  ctx.session.step = 'select_edit_tool';
  ctx.session.editTool = null;
  ctx.session.editScale = null;
  ctx.session.editImageFileId = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🖌 *Image Editing AI*\n\nPilih tool yang ingin kamu gunakan:',
    { parse_mode: 'Markdown', ...imageEditToolKeyboard() }
  );
}

// ── Select tool ───────────────────────────────────

async function handleEditTool(ctx, tool) {
  ctx.session.editTool = tool;

  if (tool === 'upscale') {
    ctx.session.step = 'select_scale';
    await ctx.editMessageText(
      '🔍 *Upscale Image*\n\nPilih tingkat upscale:',
      { parse_mode: 'Markdown', ...upscaleFactorKeyboard() }
    );
    return;
  }

  // For all other tools → ask for image
  ctx.session.step = 'awaiting_edit_image';
  const toolLabel = TOOL_LABELS[tool] || tool;

  let instructions = `${toolLabel}\n\n📷 Kirim gambar yang ingin kamu edit:`;
  if (tool === 'reimagine' || tool === 'relight') {
    instructions += `\n\n_Opsional: kirim caption/prompt bersama gambar untuk memandu AI._`;
  }

  await ctx.editMessageText(instructions, { parse_mode: 'Markdown' });
}

// ── Select upscale factor ─────────────────────────

async function handleUpscaleScale(ctx, scale) {
  ctx.session.editScale = scale;
  ctx.session.step = 'awaiting_edit_image';

  await ctx.editMessageText(
    `🔍 *Upscale ${scale}x*\n\n📷 Kirim gambar yang ingin kamu upscale:`,
    { parse_mode: 'Markdown' }
  );
}

// ── Handle photo upload ───────────────────────────

async function handleEditPhoto(ctx) {
  const step = ctx.session.step;
  const tool = ctx.session.editTool;

  if (step !== 'awaiting_edit_image' || !tool) {
    return false; // not consumed
  }

  // Get highest resolution photo
  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    await ctx.reply('❌ Tidak ada gambar terdeteksi. Kirim ulang sebagai foto.');
    return true;
  }

  const bestPhoto = photos[photos.length - 1]; // highest res
  ctx.session.editImageFileId = bestPhoto.file_id;

  // Check for caption as prompt (reimagine/relight)
  const caption = ctx.message.caption || null;
  if (caption && (tool === 'reimagine' || tool === 'relight')) {
    ctx.session.prompt = caption;
  }

  const toolLabel = TOOL_LABELS[tool] || tool;
  const scale = ctx.session.editScale;
  let summary = `🖌 *Konfirmasi Image Editing*\n\n` +
    `🔧 Tool: *${toolLabel}*\n`;
  if (scale) summary += `📐 Scale: *${scale}x*\n`;
  if (ctx.session.prompt) summary += `📝 Prompt: \`${ctx.session.prompt}\`\n`;
  summary += `📷 Gambar: ✅ Diterima\n\nLanjutkan proses?`;

  ctx.session.step = 'confirming_edit';

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    ...imageEditConfirmKeyboard(),
  });

  return true;
}

// ── Confirm & submit ──────────────────────────────

async function confirmImageEdit(ctx) {
  const { editTool, editScale, editImageFileId, prompt } = ctx.session;

  if (!editTool || !editImageFileId) {
    ctx.session.step = 'main_menu';
    await ctx.editMessageText('❌ Sesi kadaluarsa. Silakan mulai ulang.').catch(() => {});
    return sendMainMenu(ctx);
  }

  ctx.session.step = 'generating';

  await ctx.editMessageText(
    '⏳ *Sedang memproses...*\n\nJob image editing kamu sudah masuk antrian.',
    { parse_mode: 'Markdown' }
  );

  const options = {
    editTool,
    editScale: editScale || '2',
    editImageFileId,
  };

  const modelName = `edit_${editTool}`;
  const jobId = await submitJob(ctx, 'image_edit', prompt || editTool, modelName, options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job Image Edit #${jobId.slice(0, 8)} berhasil ditambahkan!*\n\n` +
      `Hasil akan dikirim otomatis setelah selesai.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.session.step = 'main_menu';
  }
}

module.exports = {
  startImageEditFlow,
  handleEditTool,
  handleUpscaleScale,
  handleEditPhoto,
  confirmImageEdit,
  TOOL_LABELS,
};
