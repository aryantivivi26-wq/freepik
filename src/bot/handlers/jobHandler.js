'use strict';

const { v4: uuidv4 } = require('uuid');
const { Job: JobModel } = require('../../models');
const { enqueueJob } = require('../../workers/queues');
const { getUserActiveJobs, incrementActiveJobs } = require('../../utils/redis');
const config = require('../../config');

/**
 * Submit a generation job to BullMQ.
 * Enforces rate limit: max 3 active jobs per user.
 *
 * @param {object} ctx - Telegraf context
 * @param {string} type - 'image'|'video'|'music'|'tts'
 * @param {string} prompt
 * @param {string} model
 * @param {object} options
 * @returns {string|null} jobId or null if rate-limited
 */
async function submitJob(ctx, type, prompt, model, options = {}) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const user = ctx.state.user;

  // ── Rate limit check ────────────────────
  const activeCount = await getUserActiveJobs(userId);
  if (activeCount >= config.bullmq.maxActiveJobsPerUser) {
    await ctx.reply(
      `⚠️ Kamu punya ${activeCount} job aktif. Tunggu selesai dulu sebelum membuat yang baru.`
    );
    return null;
  }

  // ── Credit check ────────────────────────
  if (!user.hasCredits(type)) {
    await ctx.reply(
      `❌ *Credit ${type} kamu habis!*\n\n` +
      `Upgrade plan untuk mendapatkan lebih banyak credit.\n` +
      `Ketuk *💎 Upgrade Plan* untuk melihat pilihan.`,
      { parse_mode: 'Markdown' }
    );
    return null;
  }

  // ── Deduct credit ───────────────────────
  await user.deductCredit(type);

  // ── Create job in DB ────────────────────
  const jobId = uuidv4();
  const priority = user.plan === 'free' ? 0 : user.plan === 'pro' ? 5 : 10;

  await JobModel.create({
    jobId,
    userId,
    chatId,
    type,
    model,
    prompt,
    options,
    status: 'queued',
    priority,
  });

  // ── Increment active jobs counter ───────
  await incrementActiveJobs(userId);

  // ── Enqueue to BullMQ ───────────────────
  const payload = { userId, chatId, messageId: ctx.message?.message_id || null, prompt, model, options, jobId, type, priority };
  await enqueueJob(type, payload);

  // ── Update user total jobs ──────────────
  user.totalJobs = (user.totalJobs || 0) + 1;
  await user.save();

  console.log(`[JobHandler] Submitted ${type} job ${jobId} for user ${userId}`);
  return jobId;
}

module.exports = { submitJob };
