'use strict';

const { User, Job, Transaction } = require('../../models');
const config = require('../../config');

// ── /stats ─────────────────────────────────────────────

async function handleStats(ctx) {
  const [totalUsers, totalJobs, totalPaid, bannedUsers] = await Promise.all([
    User.countDocuments(),
    Job.countDocuments(),
    Transaction.countDocuments({ status: 'paid' }),
    User.countDocuments({ isBanned: true }),
  ]);

  const planCounts = await User.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
  ]);

  const planText = planCounts
    .map((p) => `  ${p._id}: ${p.count}`)
    .join('\n');

  const jobStats = await Job.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const jobText = jobStats.map((j) => `  ${j._id}: ${j.count}`).join('\n');

  await ctx.reply(
    `📊 *Bot Statistics*\n\n` +
    `👥 Total Users: ${totalUsers}\n` +
    `🚫 Banned: ${bannedUsers}\n\n` +
    `*Plans:*\n${planText}\n\n` +
    `*Jobs:*\n${jobText}\n` +
    `📦 Total Jobs: ${totalJobs}\n\n` +
    `💰 Paid Transactions: ${totalPaid}`,
    { parse_mode: 'Markdown' }
  );
}

// ── /addcredits <id> <type> <n> ────────────────────────

async function handleAddCredits(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 4) {
    return ctx.reply('Usage: /addcredits <userId> <type> <amount>\nTypes: image | video | music | tts');
  }

  const [, targetId, type, amountStr] = parts;
  const amount = parseInt(amountStr, 10);
  const validTypes = ['image', 'video', 'music', 'tts'];

  if (!validTypes.includes(type)) {
    return ctx.reply(`Invalid type. Use: ${validTypes.join(' | ')}`);
  }
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Amount must be a positive number.');
  }

  const user = await User.findOne({ telegramId: parseInt(targetId, 10) });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.credits[type] = (user.credits[type] || 0) + amount;
  await user.save();

  await ctx.reply(`✅ Added ${amount} ${type} credits to user ${targetId}.\nNew balance: ${user.credits[type]}`);
}

// ── /setplan <id> <plan> [days] ────────────────────────

async function handleSetPlan(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    return ctx.reply('Usage: /setplan <userId> <plan> [days]\nPlans: free | pro | unlimited');
  }

  const [, targetId, plan, daysStr] = parts;
  const validPlans = ['free', 'pro', 'unlimited'];

  if (!validPlans.includes(plan)) {
    return ctx.reply(`Invalid plan. Use: ${validPlans.join(' | ')}`);
  }

  const user = await User.findOne({ telegramId: parseInt(targetId, 10) });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.plan = plan;
  const planConfig = config.plans[plan];
  user.credits = { ...planConfig.credits };

  const days = daysStr ? parseInt(daysStr, 10) : planConfig.durationDays;
  if (days) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    user.planExpiresAt = expiry;
  } else {
    user.planExpiresAt = null;
  }

  await user.save();
  await ctx.reply(`✅ User ${targetId} plan set to *${plan}* (${days || 'no'} days).`, { parse_mode: 'Markdown' });
}

// ── /ban <id> ──────────────────────────────────────────

async function handleBan(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Usage: /ban <userId>');

  const targetId = parseInt(parts[1], 10);
  const user = await User.findOne({ telegramId: targetId });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.isBanned = true;
  await user.save();
  await ctx.reply(`🚫 User ${targetId} (${user.username || user.firstName}) has been banned.`);
}

// ── /unban <id> ────────────────────────────────────────

async function handleUnban(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Usage: /unban <userId>');

  const targetId = parseInt(parts[1], 10);
  const user = await User.findOne({ telegramId: targetId });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.isBanned = false;
  await user.save();
  await ctx.reply(`✅ User ${targetId} has been unbanned.`);
}

// ── /broadcast <msg> ──────────────────────────────────

async function handleBroadcast(ctx) {
  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) return ctx.reply('Usage: /broadcast <message>');

  const users = await User.find({ isBanned: false }).select('telegramId').lean();
  let sent = 0;
  let failed = 0;

  await ctx.reply(`📢 Sending broadcast to ${users.length} users...`);

  for (const u of users) {
    try {
      await ctx.telegram.sendMessage(u.telegramId, text, { parse_mode: 'Markdown' });
      sent++;
    } catch (_) {
      failed++;
    }
    // Avoid flood limits
    await new Promise((r) => setTimeout(r, 50));
  }

  await ctx.reply(`📢 *Broadcast complete*\n✅ Sent: ${sent}\n❌ Failed: ${failed}`, { parse_mode: 'Markdown' });
}

module.exports = { handleStats, handleAddCredits, handleSetPlan, handleBan, handleUnban, handleBroadcast };
