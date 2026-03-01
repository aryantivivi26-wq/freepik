'use strict';

const { v4: uuidv4 } = require('uuid');
const { Job: JobModel, User } = require('../../models');
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

  // ── Plan expiry check ─────────────────
  if (!user.isPlanActive()) {
    await ctx.reply(
      `⚠️ *Plan ${user.plan.toUpperCase()} kamu sudah expired!*\n\n` +
      `Credit di-reset ke Free plan. Ketuk *💎 Upgrade Plan* untuk perpanjang.`,
      { parse_mode: 'Markdown' }
    );
    // Reset to free plan
    user.plan = 'free';
    user.credits = { ...config.plans.free.credits };
    user.planExpiresAt = null;
    await user.save();
    return null;
  }

  // ── Atomic credit deduction (concurrency-safe) ──
  // image_edit uses 'image' credits
  const creditType = type === 'image_edit' ? 'image' : type;
  const updatedUser = await User.atomicDeductCredit(userId, creditType);
  if (!updatedUser) {
    await ctx.reply(
      `❌ *Credit ${creditType} kamu habis!*\n\n` +
      `Upgrade plan untuk mendapatkan lebih banyak credit.\n` +
      `Ketuk *💎 Upgrade Plan* untuk melihat pilihan.`,
      { parse_mode: 'Markdown' }
    );
    return null;
  }
  // Sync local user object with updated credits
  user.credits[creditType] = updatedUser.credits[creditType];

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

  // ── Atomically increment total jobs counter ──────────
  await User.findOneAndUpdate({ telegramId: userId }, { $inc: { totalJobs: 1 } });

  console.log(`[JobHandler] Submitted ${type} job ${jobId} for user ${userId}`);
  return jobId;
}

module.exports = { submitJob };
