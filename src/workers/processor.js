'use strict';

const { Telegram } = require('telegraf');
const { Job: JobModel, User } = require('../models');
const { decrementActiveJobs } = require('../utils/redis');
const { deleteFile } = require('../utils/fileHelper');
const freepik = require('../services/freepik');
const config = require('../config');

let telegramApi = null;

function getTelegramApi() {
  if (!telegramApi) {
    telegramApi = new Telegram(config.bot.token);
  }
  return telegramApi;
}

// ── IMAGE MODEL DISPATCH ──────────────────
async function processImage(prompt, model, options) {
  const size = options?.size || 'square_1_1';
  switch (model) {
    case 'mystic':       return freepik.generateImageMystic(prompt);
    case 'flux_dev':     return freepik.generateImageFluxDev(prompt, size);
    case 'flux_2_pro':   return freepik.generateImageFlux2Pro(prompt, size);
    case 'flux_2_klein': return freepik.generateImageFlux2Klein(prompt, size);
    case 'flux_kontext': return freepik.generateImageFluxKontextPro(prompt, size);
    case 'hyperflux':    return freepik.generateImageHyperFlux(prompt, size);
    case 'seedream':     return freepik.generateImageSeedream(prompt, size);
    case 'seedream_v5':  return freepik.generateImageSeedreamV5(prompt, size);
    case 'z_image':      return freepik.generateImageZImage(prompt, size);
    default:             return freepik.generateImageClassic(prompt, size); // classic_fast
  }
}

// ── VIDEO MODEL DISPATCH ──────────────────
async function processVideo(prompt, model, options) {
  const aspectRatio = options?.aspectRatio || '16:9';
  const duration = options?.duration || '5';
  switch (model) {
    case 'kling_std':      return freepik.generateVideo(prompt, { model: 'std', aspectRatio, duration });
    case 'kling_omni_pro': return freepik.generateVideoKlingOmni(prompt, { model: 'pro', aspectRatio, duration });
    case 'kling_omni_std': return freepik.generateVideoKlingOmni(prompt, { model: 'std', aspectRatio, duration });
    case 'runway':         return freepik.generateVideoRunway(prompt, { aspectRatio, duration });
    case 'wan':            return freepik.generateVideoWan(prompt, { aspectRatio });
    case 'seedance':       return freepik.generateVideoSeedance(prompt, { aspectRatio, duration });
    default:               return freepik.generateVideo(prompt, { model: 'pro', aspectRatio, duration }); // kling_pro
  }
}

// ─────────────────────────────────────────
// MAIN PROCESSOR
// ─────────────────────────────────────────

async function processJob(bullJob) {
  const { userId, chatId, messageId, prompt, model, options, jobId, type } = bullJob.data;
  const telegram = getTelegramApi();

  console.log(`[Worker] Processing ${type} job ${jobId} (model: ${model}) for user ${userId}`);

  await JobModel.findOneAndUpdate({ jobId }, { status: 'processing', attempts: bullJob.attemptsMade + 1 });

  let filePath = null;

  try {
    // ── Generate content ──────────────────
    if (type === 'image') {
      filePath = await processImage(prompt, model, options);
    } else if (type === 'video') {
      filePath = await processVideo(prompt, model, options);
    } else if (type === 'music') {
      const duration = parseInt(options?.duration || '30', 10);
      filePath = await generateContent(() => freepik.generateMusic(prompt, duration));
    } else if (type === 'sfx') {
      const duration = parseInt(options?.duration || '10', 10);
      filePath = await generateContent(() => freepik.generateSFX(prompt, duration));
    } else if (type === 'tts') {
      const voice = options?.voice || 'rachel';
      filePath = await generateContent(() => freepik.generateTTS(prompt, voice));
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }

    // ── Send result to user ───────────────
    const caption = buildCaption(type, model, prompt, options);

    if (type === 'image') {
      await telegram.sendPhoto(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    } else if (type === 'video') {
      await telegram.sendVideo(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    } else if (type === 'music' || type === 'sfx' || type === 'tts') {
      await telegram.sendAudio(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    }

    await JobModel.findOneAndUpdate({ jobId }, { status: 'done', resultPath: filePath });
    await decrementActiveJobs(userId);

    if (filePath) {
      setTimeout(() => deleteFile(filePath), 60000);
    }

    console.log(`[Worker] Job ${jobId} completed successfully`);

  } catch (err) {
    if (err.response) {
      const detail = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data;
      console.error(`[Worker] Job ${jobId} failed — HTTP ${err.response.status}: ${detail}`);
    } else {
      console.error(`[Worker] Job ${jobId} failed:`, err.message);
    }

    await JobModel.findOneAndUpdate({ jobId }, { status: 'failed', errorMsg: err.message });

    const maxAttempts = bullJob.opts?.attempts || 3;
    const isFinalAttempt = bullJob.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await decrementActiveJobs(userId);
      await refundCredit(userId, type);
      try {
        await telegram.sendMessage(
          chatId,
          `❌ *Generasi ${typeLabel(type)} gagal*\n\nError: ${err.message}\n\nCredit kamu telah dikembalikan.`,
          { parse_mode: 'Markdown' }
        );
      } catch (sendErr) {
        console.error(`[Worker] Failed to notify user ${userId}:`, sendErr.message);
      }
    }

    if (filePath) {
      setTimeout(() => deleteFile(filePath), 5000);
    }

    throw err;
  }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

/** Simple wrapper for direct calls (music/sfx/tts) */
async function generateContent(fn) {
  return fn();
}

async function refundCredit(userId, type) {
  try {
    await User.atomicRefundCredit(userId, type);
  } catch (err) {
    console.error(`[Worker] Failed to refund credit for user ${userId}:`, err.message);
  }
}

function typeLabel(type) {
  const labels = { image: 'Gambar', video: 'Video', music: 'Musik', tts: 'TTS', sfx: 'Sound Effect' };
  return labels[type] || type;
}

const IMAGE_MODEL_LABELS = {
  classic_fast: 'Classic Fast', mystic: 'Mystic 2K', flux_dev: 'Flux Dev',
  flux_2_pro: 'Flux 2 Pro', flux_2_klein: 'Flux 2 Klein', flux_kontext: 'Flux Kontext Pro',
  hyperflux: 'HyperFlux', seedream: 'Seedream v4.5', seedream_v5: 'Seedream v5 Lite', z_image: 'Z-Image',
};

const VIDEO_MODEL_LABELS = {
  kling_pro: 'Kling v3 Pro', kling_std: 'Kling v3 Std',
  kling_omni_pro: 'Kling Omni Pro', kling_omni_std: 'Kling Omni Std',
  runway: 'Runway Gen 4.5', wan: 'Wan 2.5', seedance: 'Seedance 1.5 Pro',
};

function getModelLabel(type, model) {
  if (type === 'image') return IMAGE_MODEL_LABELS[model] || model;
  if (type === 'video') return VIDEO_MODEL_LABELS[model] || model;
  return model;
}

function buildCaption(type, model, prompt, options) {
  const maxPrompt = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt;
  const modelLabel = getModelLabel(type, model);
  const optionsText = buildOptionsText(type, options);

  return (
    `✅ *${typeLabel(type)} berhasil dibuat!*\n\n` +
    `🤖 Model: ${modelLabel}\n` +
    `📝 Prompt: \`${maxPrompt}\`` +
    (optionsText ? `\n${optionsText}` : '')
  );
}

function buildOptionsText(type, options) {
  if (!options) return '';
  const parts = [];
  if (type === 'image' && options.size) parts.push(`📐 Ukuran: ${options.size.replace(/_/g, ' ')}`);
  if (type === 'video') {
    if (options.aspectRatio) parts.push(`📺 Rasio: ${options.aspectRatio}`);
    if (options.duration) parts.push(`⏱ Durasi: ${options.duration}s`);
  }
  if ((type === 'music' || type === 'sfx') && options.duration) parts.push(`⏱ Durasi: ${options.duration}s`);
  if (type === 'tts' && options.voice) parts.push(`🎙 Suara: ${options.voice}`);
  return parts.join('\n');
}

module.exports = { processJob };
