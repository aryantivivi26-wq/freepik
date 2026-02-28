'use strict';

const { Telegram } = require('telegraf');
const { Job: JobModel, User } = require('../models');
const { decrementActiveJobs } = require('../utils/redis');
const { deleteFile } = require('../utils/fileHelper');
const {
  generateImageClassic,
  generateImageMystic,
  generateVideo,
  generateMusic,
  generateTTS,
} = require('../services/freepik');
const config = require('../config');

// Singleton Telegram API client (lighter than full Telegraf bot instance)
let telegramApi = null;

function getTelegramApi() {
  if (!telegramApi) {
    telegramApi = new Telegram(config.bot.token);
  }
  return telegramApi;
}

// ─────────────────────────────────────────
// MAIN PROCESSOR
// ─────────────────────────────────────────

/**
 * Process a generation job from BullMQ.
 * @param {import('bullmq').Job} bullJob
 */
async function processJob(bullJob) {
  const { userId, chatId, messageId, prompt, model, options, jobId, type } = bullJob.data;
  const telegram = getTelegramApi();

  console.log(`[Worker] Processing ${type} job ${jobId} for user ${userId}`);

  // Update job status in DB
  await JobModel.findOneAndUpdate({ jobId }, { status: 'processing', attempts: bullJob.attemptsMade + 1 });

  let filePath = null;

  try {
    // ── Generate content ──────────────────
    if (type === 'image') {
      if (model === 'mystic') {
        filePath = await generateImageMystic(prompt);
      } else {
        // classic_fast
        const size = options?.size || 'square_1_1';
        filePath = await generateImageClassic(prompt, size);
      }
    } else if (type === 'video') {
      filePath = await generateVideo(prompt, {
        model: model === 'kling_std' ? 'std' : 'pro',
        aspectRatio: options?.aspectRatio || '16:9',
        duration: options?.duration || '5',
      });
    } else if (type === 'music') {
      const duration = parseInt(options?.duration || '30', 10);
      filePath = await generateMusic(prompt, duration);
    } else if (type === 'tts') {
      const voice = options?.voice || 'rachel';
      filePath = await generateTTS(prompt, voice);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }

    // ── Send result to user ───────────────
    const caption = buildCaption(type, model, prompt, options);

    if (type === 'image') {
      await telegram.sendPhoto(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    } else if (type === 'video') {
      await telegram.sendVideo(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    } else if (type === 'music' || type === 'tts') {
      await telegram.sendAudio(chatId, { source: filePath }, { caption, parse_mode: 'Markdown' });
    }

    // ── Update job as done ────────────────
    await JobModel.findOneAndUpdate({ jobId }, { status: 'done', resultPath: filePath });

    // ── Decrement active jobs counter (success path — exactly once) ───
    await decrementActiveJobs(userId);

    // ── Schedule file cleanup after sending ───────────────────────────
    if (filePath) {
      setTimeout(() => deleteFile(filePath), 60000); // delete after 1 min
    }

    console.log(`[Worker] Job ${jobId} completed successfully`);

  } catch (err) {
    console.error(`[Worker] Job ${jobId} failed:`, err.message);

    // Update DB
    await JobModel.findOneAndUpdate({ jobId }, { status: 'failed', errorMsg: err.message });

    // Only decrement + refund + notify on the FINAL attempt.
    // On earlier attempts BullMQ will retry and the slot must stay occupied.
    const maxAttempts = bullJob.opts?.attempts || 3;
    const isFinalAttempt = bullJob.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      // Decrement active jobs counter (final failure — exactly once)
      await decrementActiveJobs(userId);

      await refundCredit(userId, type);
      try {
        await telegram.sendMessage(
          chatId,
          `❌ *Generasi ${typeLabel(type)} gagal*\n\n` +
          `Error: ${err.message}\n\n` +
          `Credit kamu telah dikembalikan.`,
          { parse_mode: 'Markdown' }
        );
      } catch (sendErr) {
        console.error(`[Worker] Failed to notify user ${userId}:`, sendErr.message);
      }
    }

    // Cleanup temp file on failure too
    if (filePath) {
      setTimeout(() => deleteFile(filePath), 5000);
    }

    throw err; // Let BullMQ handle retry
  }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

async function refundCredit(userId, type) {
  try {
    await User.atomicRefundCredit(userId, type);
  } catch (err) {
    console.error(`[Worker] Failed to refund credit for user ${userId}:`, err.message);
  }
}

function typeLabel(type) {
  const labels = { image: 'Gambar', video: 'Video', music: 'Musik', tts: 'TTS' };
  return labels[type] || type;
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

function getModelLabel(type, model) {
  if (type === 'image') {
    return model === 'mystic' ? 'Mystic 2K' : 'Classic Fast';
  }
  if (type === 'video') {
    return model === 'kling_std' ? 'Kling v3 Std' : 'Kling v3 Pro';
  }
  return model;
}

function buildOptionsText(type, options) {
  if (!options) return '';
  const parts = [];
  if (type === 'image' && options.size) parts.push(`📐 Ukuran: ${options.size.replace(/_/g, ' ')}`);
  if (type === 'video') {
    if (options.aspectRatio) parts.push(`📺 Rasio: ${options.aspectRatio}`);
    if (options.duration) parts.push(`⏱ Durasi: ${options.duration}s`);
  }
  if (type === 'music' && options.duration) parts.push(`⏱ Durasi: ${options.duration}s`);
  if (type === 'tts' && options.voice) parts.push(`🎙 Suara: ${options.voice}`);
  return parts.join('\n');
}

module.exports = { processJob };
