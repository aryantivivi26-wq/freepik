'use strict';

const { User, Job, Transaction } = require('../../models');
const ApiKey = require('../../models/ApiKey');
const config = require('../../config');
const apiKeyManager = require('../../utils/apiKeyManager');
const {
  adminMainKeyboard,
  userManagementKeyboard,
  userDetailKeyboard,
  planSelectionKeyboard,
  creditTypeKeyboard,
  userListPaginationKeyboard,
  creditPlanKeyboard,
  broadcastKeyboard,
  broadcastConfirmKeyboard,
  apiKeyMainKeyboard,
  apiKeyDetailKeyboard,
  systemInfoKeyboard,
} = require('../menus/adminMenu');

const PAGE_SIZE = 10;

// ═══════════════════════════════════════════════════════
//  ADMIN MAIN MENU
// ═══════════════════════════════════════════════════════

async function showAdminMenu(ctx) {
  const text =
    `🛡 *Admin Panel — Hubify Studio*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih menu admin:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...adminMainKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...adminMainKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...adminMainKeyboard() });
}

// ═══════════════════════════════════════════════════════
//  STATISTICS
// ═══════════════════════════════════════════════════════

async function showStats(ctx) {
  const [totalUsers, totalJobs, totalPaid, bannedUsers, activeKeys] = await Promise.all([
    User.countDocuments(),
    Job.countDocuments(),
    Transaction.countDocuments({ status: 'paid' }),
    User.countDocuments({ isBanned: true }),
    ApiKey.countDocuments({ isActive: true }),
  ]);

  const planCounts = await User.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
  ]);
  const planText = planCounts.map((p) => `  ${p._id}: ${p.count}`).join('\n') || '  -';

  const jobStats = await Job.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const jobText = jobStats.map((j) => `  ${j._id}: ${j.count}`).join('\n') || '  -';

  // Revenue
  const revenue = await Transaction.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amountTotal' } } },
  ]);
  const totalRevenue = revenue[0]?.total || 0;

  // Recent 24h stats
  const past24h = new Date(Date.now() - 86400000);
  const [newUsers24h, newJobs24h, newTx24h] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: past24h } }),
    Job.countDocuments({ createdAt: { $gte: past24h } }),
    Transaction.countDocuments({ status: 'paid', paidAt: { $gte: past24h } }),
  ]);

  const text =
    `📊 *Bot Statistics*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 Total Users: *${totalUsers}*\n` +
    `🚫 Banned: ${bannedUsers}\n` +
    `🔑 Active API Keys: ${activeKeys}\n\n` +
    `*Plans:*\n${planText}\n\n` +
    `*Jobs:*\n${jobText}\n` +
    `📦 Total Jobs: ${totalJobs}\n\n` +
    `💰 Revenue: Rp ${totalRevenue.toLocaleString('id-ID')}\n` +
    `💳 Paid Transactions: ${totalPaid}\n\n` +
    `*Last 24 Jam:*\n` +
    `  👤 New Users: ${newUsers24h}\n` +
    `  📦 New Jobs: ${newJobs24h}\n` +
    `  💳 Paid: ${newTx24h}`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: 'admin:stats' }],
        [{ text: '🔙 Admin Menu', callback_data: 'admin:menu' }],
      ],
    },
  };

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ═══════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════

async function showUserManagement(ctx) {
  const text =
    `👥 *User Management*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih aksi:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...userManagementKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() });
}

// ── Search User ────────────────────────────
async function promptUserSearch(ctx) {
  ctx.session.adminStep = 'awaiting_user_search';
  const text = `🔍 *Cari User*\n\nKirim Telegram ID atau @username:`;
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown' });
  }
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleUserSearch(ctx) {
  const query = ctx.message.text.trim();
  ctx.session.adminStep = null;

  let user;
  if (/^\d+$/.test(query)) {
    user = await User.findOne({ telegramId: parseInt(query, 10) });
  } else {
    const username = query.replace(/^@/, '');
    user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  }

  if (!user) {
    return ctx.reply(`❌ User "${query}" tidak ditemukan.`, { ...userManagementKeyboard() });
  }

  return showUserDetail(ctx, user);
}

// ── User Detail ────────────────────────────
async function showUserDetail(ctx, userOrId) {
  let user = userOrId;
  if (typeof userOrId === 'number' || typeof userOrId === 'string') {
    user = await User.findOne({ telegramId: parseInt(userOrId, 10) });
  }
  if (!user) {
    return ctx.reply('❌ User tidak ditemukan.');
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
  const planExpiry = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('id-ID')
    : '-';

  const totalUserJobs = await Job.countDocuments({ userId: user.telegramId });
  const totalUserTx = await Transaction.countDocuments({ userId: user.telegramId, status: 'paid' });

  const text =
    `👤 *User Detail*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📛 Name: *${name}*\n` +
    `🏷 Username: ${user.username ? '@' + user.username : '-'}\n` +
    `🆔 ID: \`${user.telegramId}\`\n` +
    `📋 Plan: *${user.plan.toUpperCase()}*\n` +
    `📅 Expires: ${planExpiry}\n` +
    `${user.isBanned ? '🚫 *BANNED*\n' : ''}` +
    `\n*Credits:*\n` +
    `  🎨 Image: ${user.credits.image}\n` +
    `  🎬 Video: ${user.credits.video}\n` +
    `  🎵 Music: ${user.credits.music}\n` +
    `  🎧 SFX: ${user.credits.sfx || 0}\n` +
    `  🔊 TTS: ${user.credits.tts}\n\n` +
    `📦 Total Jobs: ${totalUserJobs}\n` +
    `💳 Paid Transactions: ${totalUserTx}\n` +
    `📅 Joined: ${new Date(user.createdAt).toLocaleDateString('id-ID')}`;

  const keyboard = userDetailKeyboard(user.telegramId, user.isBanned);

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ── List Subscribers (Pro/Unlimited) ───────
async function listSubscribers(ctx, page = 0) {
  const filter = { plan: { $in: ['pro', 'unlimited'] } };
  const total = await User.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);

  const users = await User.find(filter)
    .sort({ updatedAt: -1 })
    .skip(clampedPage * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  if (users.length === 0) {
    const text = `👑 *Subscribers*\n\nBelum ada subscriber.`;
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...userManagementKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() })
    );
  }

  const lines = users.map((u, i) => {
    const idx = clampedPage * PAGE_SIZE + i + 1;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown';
    const expiry = u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString('id-ID') : '-';
    return `${idx}. *${name}*\n   ID: \`${u.telegramId}\` | ${u.plan.toUpperCase()} | Exp: ${expiry}`;
  });

  const text =
    `👑 *Subscribers* (${total} total)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n');

  const keyboard = userListPaginationKeyboard(clampedPage, totalPages, 'admin:subspage');

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ── List All Users ─────────────────────────
async function listAllUsers(ctx, page = 0) {
  const total = await User.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);

  const users = await User.find()
    .sort({ createdAt: -1 })
    .skip(clampedPage * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const lines = users.map((u, i) => {
    const idx = clampedPage * PAGE_SIZE + i + 1;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown';
    const badge = u.isBanned ? '🚫' : u.plan === 'unlimited' ? '♾️' : u.plan === 'pro' ? '🚀' : '🆓';
    return `${idx}. ${badge} *${name}*\n   ID: \`${u.telegramId}\` | ${u.plan.toUpperCase()}`;
  });

  const text =
    `📋 *Semua User* (${total} total)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n');

  const keyboard = userListPaginationKeyboard(clampedPage, totalPages, 'admin:allpage');

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ── List Banned Users ──────────────────────
async function listBannedUsers(ctx, page = 0) {
  const filter = { isBanned: true };
  const total = await User.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);

  const users = await User.find(filter)
    .sort({ updatedAt: -1 })
    .skip(clampedPage * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  if (users.length === 0) {
    const text = `🚫 *Banned Users*\n\nTidak ada user yang di-ban.`;
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...userManagementKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() })
    );
  }

  const lines = users.map((u, i) => {
    const idx = clampedPage * PAGE_SIZE + i + 1;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown';
    return `${idx}. 🚫 *${name}*\n   ID: \`${u.telegramId}\` | @${u.username || '-'}`;
  });

  const text =
    `🚫 *Banned Users* (${total} total)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n');

  const keyboard = userListPaginationKeyboard(clampedPage, totalPages, 'admin:bannedpage');

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ── Recent Users ───────────────────────────
async function listRecentUsers(ctx) {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  const lines = users.map((u, i) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown';
    const badge = u.plan === 'unlimited' ? '♾️' : u.plan === 'pro' ? '🚀' : '🆓';
    const date = new Date(u.createdAt).toLocaleDateString('id-ID');
    return `${i + 1}. ${badge} *${name}*\n   ID: \`${u.telegramId}\` | ${date}`;
  });

  const text =
    `📈 *15 User Terbaru*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n');

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...userManagementKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...userManagementKeyboard() });
}

// ── Ban / Unban ────────────────────────────
async function handleBan(ctx, telegramId) {
  const user = await User.findOneAndUpdate(
    { telegramId: parseInt(telegramId, 10) },
    { isBanned: true },
    { new: true }
  );
  if (!user) return ctx.answerCbQuery('User tidak ditemukan', { show_alert: true });
  await ctx.answerCbQuery(`✅ User ${telegramId} telah di-ban`);
  return showUserDetail(ctx, user);
}

async function handleUnban(ctx, telegramId) {
  const user = await User.findOneAndUpdate(
    { telegramId: parseInt(telegramId, 10) },
    { isBanned: false },
    { new: true }
  );
  if (!user) return ctx.answerCbQuery('User tidak ditemukan', { show_alert: true });
  await ctx.answerCbQuery(`✅ User ${telegramId} telah di-unban`);
  return showUserDetail(ctx, user);
}

// ── Set Plan ───────────────────────────────
async function showPlanSelection(ctx, telegramId) {
  const text = `📋 *Set Plan*\n\nPilih plan untuk user \`${telegramId}\`:`;
  return ctx.editMessageText(text, { parse_mode: 'Markdown', ...planSelectionKeyboard(telegramId) }).catch(() =>
    ctx.reply(text, { parse_mode: 'Markdown', ...planSelectionKeyboard(telegramId) })
  );
}

async function handleSetPlan(ctx, telegramId, plan) {
  const user = await User.findOne({ telegramId: parseInt(telegramId, 10) });
  if (!user) return ctx.answerCbQuery('User tidak ditemukan', { show_alert: true });

  const planConfig = config.plans[plan];
  user.plan = plan;
  user.credits = { ...planConfig.credits };

  if (planConfig.durationDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + planConfig.durationDays);
    user.planExpiresAt = expiry;
  } else {
    user.planExpiresAt = null;
  }

  await user.save();
  await ctx.answerCbQuery(`✅ Plan diubah ke ${plan.toUpperCase()}`);

  // Notify user
  try {
    await ctx.telegram.sendMessage(
      parseInt(telegramId, 10),
      `🎉 *Plan kamu telah diupgrade!*\n\n` +
      `📋 Plan: *${plan.toUpperCase()}*\n` +
      `${planConfig.durationDays ? `📅 Berlaku: ${planConfig.durationDays} hari\n` : ''}` +
      `\n*Credits Baru:*\n` +
      `  🎨 Image: ${planConfig.credits.image}\n` +
      `  🎬 Video: ${planConfig.credits.video}\n` +
      `  🎵 Music: ${planConfig.credits.music}\n` +
      `  🎧 SFX: ${planConfig.credits.sfx}\n` +
      `  🔊 TTS: ${planConfig.credits.tts}`,
      { parse_mode: 'Markdown' }
    );
  } catch (_) {}

  return showUserDetail(ctx, user);
}

// ── Add Credits ────────────────────────────
async function showCreditTypeSelection(ctx, telegramId) {
  const text = `➕ *Add Credits*\n\nPilih tipe credit untuk user \`${telegramId}\`:`;
  return ctx.editMessageText(text, { parse_mode: 'Markdown', ...creditTypeKeyboard(telegramId) }).catch(() =>
    ctx.reply(text, { parse_mode: 'Markdown', ...creditTypeKeyboard(telegramId) })
  );
}

async function promptCreditAmount(ctx, telegramId, type) {
  ctx.session.adminStep = 'awaiting_credit_amount';
  ctx.session.adminTarget = parseInt(telegramId, 10);
  ctx.session.adminCreditType = type;

  const text = `➕ *Add ${type.toUpperCase()} Credits*\n\nKirim jumlah credit untuk user \`${telegramId}\`:`;
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown' });
  }
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleAddCredits(ctx) {
  const amount = parseInt(ctx.message.text.trim(), 10);
  const targetId = ctx.session.adminTarget;
  const type = ctx.session.adminCreditType;

  ctx.session.adminStep = null;
  ctx.session.adminTarget = null;
  ctx.session.adminCreditType = null;

  if (isNaN(amount) || amount <= 0 || amount > 99999) {
    return ctx.reply('❌ Jumlah harus angka positif (1-99999).\n\nKembali ke /admin');
  }

  const user = await User.findOneAndUpdate(
    { telegramId: targetId },
    { $inc: { [`credits.${type}`]: amount } },
    { new: true }
  );

  if (!user) return ctx.reply('❌ User tidak ditemukan.');

  await ctx.reply(
    `✅ *Credit ditambahkan!*\n\n` +
    `👤 User: \`${targetId}\`\n` +
    `➕ +${amount} ${type}\n` +
    `💰 Saldo ${type}: ${user.credits[type]}`,
    { parse_mode: 'Markdown' }
  );

  return showUserDetail(ctx, user);
}

// ── Add All Credits +50 ───────────────────
async function handleAddAllCredits(ctx, telegramId) {
  const user = await User.findOneAndUpdate(
    { telegramId: parseInt(telegramId, 10) },
    {
      $inc: {
        'credits.image': 50,
        'credits.video': 50,
        'credits.music': 50,
        'credits.sfx': 50,
        'credits.tts': 50,
      },
    },
    { new: true }
  );

  if (!user) return ctx.answerCbQuery('User tidak ditemukan', { show_alert: true });
  await ctx.answerCbQuery('✅ +50 semua credits');
  return showUserDetail(ctx, user);
}

// ── Reset Credits ──────────────────────────
async function handleResetCredits(ctx, telegramId) {
  const user = await User.findOne({ telegramId: parseInt(telegramId, 10) });
  if (!user) return ctx.answerCbQuery('User tidak ditemukan', { show_alert: true });

  const planConfig = config.plans[user.plan];
  user.credits = { ...planConfig.credits };
  await user.save();

  await ctx.answerCbQuery('✅ Credits di-reset ke default plan');
  return showUserDetail(ctx, user);
}

// ── User Jobs ──────────────────────────────
async function showUserJobs(ctx, telegramId) {
  const jobs = await Job.find({ userId: parseInt(telegramId, 10) })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  if (jobs.length === 0) {
    return ctx.editMessageText(
      `📦 *Jobs untuk user \`${telegramId}\`*\n\nBelum ada job.`,
      { parse_mode: 'Markdown', ...userDetailKeyboard(telegramId, false) }
    ).catch(() => ctx.reply(`Belum ada job.`));
  }

  const lines = jobs.map((j, i) => {
    const status = j.status === 'done' ? '✅' : j.status === 'failed' ? '❌' : j.status === 'processing' ? '⏳' : '🕐';
    const date = new Date(j.createdAt).toLocaleDateString('id-ID');
    return `${i + 1}. ${status} ${j.type}/${j.model} — ${date}`;
  });

  const text =
    `📦 *10 Job Terakhir — User \`${telegramId}\`*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n');

  return ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 User Detail', callback_data: `admin:userdetail:${telegramId}` }],
      ],
    },
  }).catch(() => ctx.reply(text, { parse_mode: 'Markdown' }));
}

// ═══════════════════════════════════════════════════════
//  CREDIT & PLAN (Bulk)
// ═══════════════════════════════════════════════════════

async function showCreditPlanMenu(ctx) {
  const text =
    `💳 *Credit & Plan Management*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih aksi:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...creditPlanKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...creditPlanKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...creditPlanKeyboard() });
}

async function promptCpSearch(ctx) {
  ctx.session.adminStep = 'awaiting_cp_search';
  const text = `🔍 Kirim Telegram ID atau @username untuk set plan/credit:`;
  return ctx.editMessageText(text, { parse_mode: 'Markdown' }).catch(() =>
    ctx.reply(text, { parse_mode: 'Markdown' })
  );
}

async function handleCpSearch(ctx) {
  const query = ctx.message.text.trim();
  ctx.session.adminStep = null;

  let user;
  if (/^\d+$/.test(query)) {
    user = await User.findOne({ telegramId: parseInt(query, 10) });
  } else {
    const username = query.replace(/^@/, '');
    user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  }

  if (!user) {
    return ctx.reply(`❌ User "${query}" tidak ditemukan.`);
  }
  return showUserDetail(ctx, user);
}

async function handleBulkPro(ctx) {
  const freeUsers = await User.countDocuments({ plan: 'free' });
  await ctx.answerCbQuery();

  ctx.session.adminStep = 'confirm_bulk_pro';
  const text =
    `⚠️ *Bulk Pro Upgrade*\n\n` +
    `Ini akan meng-upgrade ${freeUsers} user Free ke Pro (30 hari).\n\n` +
    `Kirim "CONFIRM" untuk melanjutkan:`;

  return ctx.editMessageText(text, { parse_mode: 'Markdown' });
}

async function executeBulkPro(ctx) {
  ctx.session.adminStep = null;

  if (ctx.message.text.trim() !== 'CONFIRM') {
    return ctx.reply('❌ Dibatalkan.');
  }

  const planConfig = config.plans.pro;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + planConfig.durationDays);

  const result = await User.updateMany(
    { plan: 'free' },
    {
      plan: 'pro',
      credits: { ...planConfig.credits },
      planExpiresAt: expiry,
    }
  );

  return ctx.reply(
    `✅ *Bulk Pro Upgrade selesai!*\n\n` +
    `📊 ${result.modifiedCount} user diupgrade ke Pro.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleBulkCredits(ctx) {
  await ctx.answerCbQuery();
  ctx.session.adminStep = 'awaiting_bulk_credits';

  const text =
    `🎁 *Bulk Add Credits*\n\n` +
    `Kirim format:\n\`<type> <jumlah>\`\n\n` +
    `Contoh: \`image 10\` (semua user +10 image)\n` +
    `Types: image, video, music, sfx, tts`;

  return ctx.editMessageText(text, { parse_mode: 'Markdown' }).catch(() =>
    ctx.reply(text, { parse_mode: 'Markdown' })
  );
}

async function executeBulkCredits(ctx) {
  const parts = ctx.message.text.trim().split(/\s+/);
  ctx.session.adminStep = null;

  if (parts.length < 2) return ctx.reply('❌ Format salah. Contoh: `image 10`', { parse_mode: 'Markdown' });

  const [type, amountStr] = parts;
  const validTypes = ['image', 'video', 'music', 'sfx', 'tts'];
  if (!validTypes.includes(type)) return ctx.reply(`❌ Type tidak valid. Gunakan: ${validTypes.join(', ')}`);

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0 || amount > 9999) return ctx.reply('❌ Jumlah harus 1-9999.');

  const result = await User.updateMany(
    { isBanned: false },
    { $inc: { [`credits.${type}`]: amount } }
  );

  return ctx.reply(
    `✅ *Bulk Credits selesai!*\n\n` +
    `📊 ${result.modifiedCount} user mendapat +${amount} ${type}.`,
    { parse_mode: 'Markdown' }
  );
}

// ── Revenue Report ─────────────────────────
async function showRevenue(ctx) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totalRevenue, monthlyRevenue, lastMonthRevenue, recentTx] = await Promise.all([
    Transaction.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountTotal' } } },
    ]),
    Transaction.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountTotal' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: lastMonth, $lt: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountTotal' }, count: { $sum: 1 } } },
    ]),
    Transaction.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(5).lean(),
  ]);

  const recent = recentTx.map((tx) => {
    const date = new Date(tx.paidAt).toLocaleDateString('id-ID');
    return `  • ${tx.plan.toUpperCase()} — Rp ${tx.amountTotal.toLocaleString('id-ID')} (${date})`;
  }).join('\n') || '  -';

  const text =
    `💰 *Revenue Report*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 Total Revenue: *Rp ${(totalRevenue[0]?.total || 0).toLocaleString('id-ID')}*\n\n` +
    `📅 Bulan Ini:\n` +
    `  💳 ${monthlyRevenue[0]?.count || 0} transaksi\n` +
    `  💰 Rp ${(monthlyRevenue[0]?.total || 0).toLocaleString('id-ID')}\n\n` +
    `📅 Bulan Lalu:\n` +
    `  💳 ${lastMonthRevenue[0]?.count || 0} transaksi\n` +
    `  💰 Rp ${(lastMonthRevenue[0]?.total || 0).toLocaleString('id-ID')}\n\n` +
    `*5 Transaksi Terakhir:*\n${recent}`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: 'admin:revenue' }],
        [{ text: '🔙 Admin Menu', callback_data: 'admin:menu' }],
      ],
    },
  };

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...keyboard })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

// ═══════════════════════════════════════════════════════
//  BROADCAST
// ═══════════════════════════════════════════════════════

async function showBroadcastMenu(ctx) {
  const text =
    `📢 *Broadcast*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih target broadcast:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...broadcastKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...broadcastKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...broadcastKeyboard() });
}

async function promptBroadcast(ctx, target) {
  ctx.session.adminStep = 'awaiting_broadcast';
  ctx.session.broadcastTarget = target; // 'all', 'subs', 'free'

  let targetLabel = 'semua user';
  if (target === 'subs') targetLabel = 'user Pro/Unlimited';
  if (target === 'free') targetLabel = 'user Free';

  const count = await getBroadcastCount(target);

  const text =
    `📢 *Broadcast ke ${targetLabel}*\n\n` +
    `👥 Target: ${count} user\n\n` +
    `Kirim pesan yang ingin di-broadcast (support Markdown):`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown' });
  }
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function getBroadcastCount(target) {
  if (target === 'subs') return User.countDocuments({ plan: { $in: ['pro', 'unlimited'] }, isBanned: false });
  if (target === 'free') return User.countDocuments({ plan: 'free', isBanned: false });
  return User.countDocuments({ isBanned: false });
}

async function handleBroadcastPreview(ctx) {
  const text = ctx.message.text.trim();
  ctx.session.broadcastMessage = text;
  ctx.session.adminStep = 'confirm_broadcast';

  const target = ctx.session.broadcastTarget;
  const count = await getBroadcastCount(target);

  let targetLabel = 'semua user';
  if (target === 'subs') targetLabel = 'user Pro/Unlimited';
  if (target === 'free') targetLabel = 'user Free';

  const preview =
    `📢 *Preview Broadcast*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🎯 Target: ${targetLabel} (${count} user)\n\n` +
    `*Pesan:*\n${text}\n\n` +
    `Kirim broadcast ini?`;

  return ctx.reply(preview, { parse_mode: 'Markdown', ...broadcastConfirmKeyboard() });
}

async function executeBroadcast(ctx) {
  const target = ctx.session.broadcastTarget;
  const message = ctx.session.broadcastMessage;

  ctx.session.adminStep = null;
  ctx.session.broadcastTarget = null;
  ctx.session.broadcastMessage = null;

  if (!message) return ctx.reply('❌ Pesan broadcast kosong.');

  let filter = { isBanned: false };
  if (target === 'subs') filter.plan = { $in: ['pro', 'unlimited'] };
  if (target === 'free') filter.plan = 'free';

  const users = await User.find(filter).select('telegramId').lean();
  let sent = 0;
  let failed = 0;

  const statusMsg = await ctx.reply(`📢 Mengirim broadcast ke ${users.length} user... 0%`);

  for (let i = 0; i < users.length; i++) {
    try {
      await ctx.telegram.sendMessage(users[i].telegramId, message, { parse_mode: 'Markdown' });
      sent++;
    } catch (_) {
      failed++;
    }
    // Update progress every 20 users
    if ((i + 1) % 20 === 0 || i === users.length - 1) {
      const pct = Math.round(((i + 1) / users.length) * 100);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `📢 Mengirim broadcast... ${pct}% (${sent}/${users.length})`
      ).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 35));
  }

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    undefined,
    `📢 *Broadcast selesai!*\n\n✅ Terkirim: ${sent}\n❌ Gagal: ${failed}\n📊 Total: ${users.length}`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
}

async function cancelBroadcast(ctx) {
  ctx.session.adminStep = null;
  ctx.session.broadcastTarget = null;
  ctx.session.broadcastMessage = null;
  await ctx.answerCbQuery('Broadcast dibatalkan');
  return showBroadcastMenu(ctx);
}

// ═══════════════════════════════════════════════════════
//  API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════

async function showApiKeyMenu(ctx) {
  const stats = await apiKeyManager.getStats();

  const text =
    `🔑 *API Key Management*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 Total Keys: ${stats.total}\n` +
    `✅ Active: ${stats.active}\n` +
    `⏸ Inactive: ${stats.inactive}\n` +
    `📈 Total Requests: ${stats.totalRequests.toLocaleString()}\n\n` +
    `Pilih aksi:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() });
}

async function listApiKeys(ctx) {
  const keys = await apiKeyManager.listKeys();

  if (keys.length === 0) {
    const envKey = config.freepik.apiKey;
    const text =
      `📋 *API Keys*\n\n` +
      `Belum ada key di database.\n` +
      `${envKey ? `⚙️ Menggunakan env var: \`${envKey.slice(0, 8)}...${envKey.slice(-4)}\`` : '⚠️ Tidak ada key!'}`;

    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() })
    );
  }

  const lines = keys.map((k, i) => {
    const status = k.isActive ? '✅' : '⏸';
    const label = k.label || `Key #${i + 1}`;
    const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('id-ID') : 'Never';
    return `${i + 1}. ${status} *${label}*\n   \`${k.masked()}\`\n   📈 ${k.requestCount} req | Last: ${lastUsed}${k.errorCount > 0 ? ` | ⚠️ ${k.errorCount} errors` : ''}`;
  });

  const text =
    `📋 *API Keys* (${keys.length} total)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n');

  // Build detail buttons for each key
  const keyButtons = keys.map((k, i) => {
    const label = k.label || `Key #${i + 1}`;
    const status = k.isActive ? '✅' : '⏸';
    return [{ text: `${status} ${label}`, callback_data: `admin:ak_detail:${k._id}` }];
  });
  keyButtons.push([{ text: '➕ Tambah Key', callback_data: 'admin:ak_add' }]);
  keyButtons.push([{ text: '🔙 Admin Menu', callback_data: 'admin:menu' }]);

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyButtons },
    }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyButtons } })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyButtons } });
}

async function showApiKeyDetail(ctx, keyId) {
  const key = await ApiKey.findById(keyId);
  if (!key) return ctx.answerCbQuery('Key tidak ditemukan', { show_alert: true });

  const text =
    `🔑 *API Key Detail*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📛 Label: *${key.label || '-'}*\n` +
    `🔑 Key: \`${key.masked()}\`\n` +
    `${key.isActive ? '✅ Active' : '⏸ Disabled'}\n\n` +
    `📈 Requests: ${key.requestCount.toLocaleString()}\n` +
    `⚠️ Consecutive Errors: ${key.errorCount}\n` +
    `📅 Last Used: ${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('id-ID') : 'Never'}\n` +
    `📅 Added: ${new Date(key.createdAt).toLocaleDateString('id-ID')}`;

  return ctx.editMessageText(text, { parse_mode: 'Markdown', ...apiKeyDetailKeyboard(keyId, key.isActive) }).catch(() =>
    ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyDetailKeyboard(keyId, key.isActive) })
  );
}

async function promptAddApiKey(ctx) {
  ctx.session.adminStep = 'awaiting_apikey';
  const text =
    `➕ *Tambah API Key*\n\n` +
    `Kirim API key Freepik baru.\n` +
    `Format: \`<api_key>\` atau \`<label> <api_key>\`\n\n` +
    `Contoh:\n` +
    `\`fpk-abc123def456...\`\n` +
    `\`Akun2 fpk-abc123def456...\``;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown' });
  }
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleAddApiKey(ctx) {
  const input = ctx.message.text.trim();
  ctx.session.adminStep = null;

  let label = null;
  let key = input;

  // Check if first word is a label (doesn't look like an API key)
  const parts = input.split(/\s+/);
  if (parts.length >= 2 && !parts[0].startsWith('fpk')) {
    label = parts[0];
    key = parts.slice(1).join('');
  }

  if (key.length < 10) {
    return ctx.reply('❌ API key terlalu pendek. Pastikan format benar.');
  }

  const result = await apiKeyManager.addKey(key, label, ctx.from.id);

  if (result.duplicate) {
    return ctx.reply('⚠️ API key ini sudah terdaftar dan aktif.');
  }

  if (result.reactivated) {
    await ctx.reply(
      `♻️ *API Key diaktifkan kembali!*\n\n` +
      `🔑 \`${result.doc.masked()}\`\n` +
      `📛 Label: ${result.doc.label || '-'}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      `✅ *API Key ditambahkan!*\n\n` +
      `🔑 \`${result.doc.masked()}\`\n` +
      `📛 Label: ${result.doc.label || '-'}`,
      { parse_mode: 'Markdown' }
    );
  }

  // Auto-test the new key
  const testResult = await apiKeyManager.testKey(key);
  if (testResult.ok) {
    await ctx.reply(`🧪 Test: ✅ Key valid (HTTP ${testResult.status})`);
  } else {
    await ctx.reply(`🧪 Test: ⚠️ Key mungkin bermasalah (HTTP ${testResult.status}${testResult.error ? `, ${testResult.error}` : ''})`);
  }

  return showApiKeyMenu(ctx);
}

async function handleToggleApiKey(ctx, keyId) {
  const key = await apiKeyManager.toggleKey(keyId);
  if (!key) return ctx.answerCbQuery('Key tidak ditemukan', { show_alert: true });

  await ctx.answerCbQuery(`Key ${key.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
  return showApiKeyDetail(ctx, keyId);
}

async function handleTestApiKey(ctx, keyId) {
  const keyDoc = await ApiKey.findById(keyId);
  if (!keyDoc) return ctx.answerCbQuery('Key tidak ditemukan', { show_alert: true });

  await ctx.answerCbQuery('🧪 Testing key...');

  const result = await apiKeyManager.testKey(keyDoc.key);
  const statusText = result.ok ? '✅ Valid' : '❌ Invalid';

  await ctx.reply(
    `🧪 *Test Result*\n\n` +
    `🔑 \`${keyDoc.masked()}\`\n` +
    `📊 Status: ${statusText} (HTTP ${result.status})\n` +
    `${result.error ? `⚠️ Error: ${result.error}` : ''}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleDeleteApiKey(ctx, keyId) {
  const key = await apiKeyManager.deleteKey(keyId);
  if (!key) return ctx.answerCbQuery('Key tidak ditemukan', { show_alert: true });

  await ctx.answerCbQuery('🗑 Key dihapus permanen');
  return listApiKeys(ctx);
}

async function showApiKeyStats(ctx) {
  const keys = await apiKeyManager.listKeys();
  const stats = await apiKeyManager.getStats();

  const topKeys = [...keys].sort((a, b) => b.requestCount - a.requestCount).slice(0, 5);

  const topText = topKeys.map((k, i) => {
    const label = k.label || `Key #${i + 1}`;
    return `  ${i + 1}. ${label}: ${k.requestCount.toLocaleString()} req`;
  }).join('\n') || '  -';

  const text =
    `📊 *API Key Rotation Stats*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📦 Total Keys: ${stats.total}\n` +
    `✅ Active: ${stats.active}\n` +
    `⏸ Inactive: ${stats.inactive}\n` +
    `📈 Total Requests: ${stats.totalRequests.toLocaleString()}\n` +
    `🔄 Current Rotation Index: ${stats.currentIndex}\n\n` +
    `*Top Keys by Usage:*\n${topText}\n\n` +
    `*Rotation Mode:* Round-Robin\n` +
    `*Auto-Disable:* After 10 consecutive errors`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...apiKeyMainKeyboard() });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM INFO
// ═══════════════════════════════════════════════════════

async function showSystemInfo(ctx) {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const memUsage = process.memoryUsage();
  const mbUsed = (memUsage.rss / 1024 / 1024).toFixed(1);
  const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(1);

  const [activeKeys, pendingJobs, processingJobs] = await Promise.all([
    ApiKey.countDocuments({ isActive: true }),
    Job.countDocuments({ status: 'queued' }),
    Job.countDocuments({ status: 'processing' }),
  ]);

  const text =
    `📋 *System Info*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⏱ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
    `💾 Memory: ${mbUsed} MB (Heap: ${heapUsed} MB)\n` +
    `🖥 Node: ${process.version}\n` +
    `📅 Time: ${new Date().toLocaleString('id-ID')}\n\n` +
    `*Queue Status:*\n` +
    `  🕐 Queued: ${pendingJobs}\n` +
    `  ⏳ Processing: ${processingJobs}\n\n` +
    `*API Keys:*\n` +
    `  ✅ Active Keys: ${activeKeys}\n` +
    `  ⚙️ Env Key: ${config.freepik.apiKey ? 'Set' : 'Not set'}`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...systemInfoKeyboard() }).catch(() =>
      ctx.reply(text, { parse_mode: 'Markdown', ...systemInfoKeyboard() })
    );
  }
  return ctx.reply(text, { parse_mode: 'Markdown', ...systemInfoKeyboard() });
}

// ═══════════════════════════════════════════════════════
//  ADMIN TEXT MESSAGE ROUTER
// ═══════════════════════════════════════════════════════

/**
 * Handle admin text input based on current adminStep session.
 * Returns true if message was consumed, false otherwise.
 */
async function handleAdminTextInput(ctx) {
  const step = ctx.session.adminStep;
  if (!step) return false;

  switch (step) {
    case 'awaiting_user_search':
      await handleUserSearch(ctx);
      return true;
    case 'awaiting_credit_amount':
      await handleAddCredits(ctx);
      return true;
    case 'awaiting_cp_search':
      await handleCpSearch(ctx);
      return true;
    case 'confirm_bulk_pro':
      await executeBulkPro(ctx);
      return true;
    case 'awaiting_bulk_credits':
      await executeBulkCredits(ctx);
      return true;
    case 'awaiting_broadcast':
      await handleBroadcastPreview(ctx);
      return true;
    case 'awaiting_apikey':
      await handleAddApiKey(ctx);
      return true;
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════
//  LEGACY COMMAND HANDLERS (backward compat)
// ═══════════════════════════════════════════════════════

async function handleStatsCommand(ctx) {
  return showStats(ctx);
}

async function handleAddCreditsCommand(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 4) {
    return ctx.reply('Usage: /addcredits <userId> <type> <amount>\nTypes: image | video | music | tts | sfx');
  }

  const [, targetId, type, amountStr] = parts;
  const amount = parseInt(amountStr, 10);
  const validTypes = ['image', 'video', 'music', 'tts', 'sfx'];

  if (!validTypes.includes(type)) return ctx.reply(`Invalid type. Use: ${validTypes.join(' | ')}`);
  if (isNaN(amount) || amount <= 0) return ctx.reply('Amount must be a positive number.');

  const user = await User.findOneAndUpdate(
    { telegramId: parseInt(targetId, 10) },
    { $inc: { [`credits.${type}`]: amount } },
    { new: true }
  );
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  await ctx.reply(`✅ Added ${amount} ${type} credits to user ${targetId}.\nNew balance: ${user.credits[type]}`);
}

async function handleSetPlanCommand(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    return ctx.reply('Usage: /setplan <userId> <plan> [days]\nPlans: free | pro | unlimited');
  }

  const [, targetId, plan, daysStr] = parts;
  const validPlans = ['free', 'pro', 'unlimited'];

  if (!validPlans.includes(plan)) return ctx.reply(`Invalid plan. Use: ${validPlans.join(' | ')}`);

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

async function handleBanCommand(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Usage: /ban <userId>');

  const targetId = parseInt(parts[1], 10);
  const user = await User.findOne({ telegramId: targetId });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.isBanned = true;
  await user.save();
  await ctx.reply(`🚫 User ${targetId} (${user.username || user.firstName}) has been banned.`);
}

async function handleUnbanCommand(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Usage: /unban <userId>');

  const targetId = parseInt(parts[1], 10);
  const user = await User.findOne({ telegramId: targetId });
  if (!user) return ctx.reply(`User ${targetId} not found.`);

  user.isBanned = false;
  await user.save();
  await ctx.reply(`✅ User ${targetId} has been unbanned.`);
}

async function handleBroadcastCommand(ctx) {
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
    await new Promise((r) => setTimeout(r, 50));
  }

  await ctx.reply(`📢 *Broadcast complete*\n✅ Sent: ${sent}\n❌ Failed: ${failed}`, { parse_mode: 'Markdown' });
}

module.exports = {
  // Interactive admin panel
  showAdminMenu,
  showStats,
  showUserManagement,
  promptUserSearch,
  showUserDetail,
  listSubscribers,
  listAllUsers,
  listBannedUsers,
  listRecentUsers,
  handleBan,
  handleUnban,
  showPlanSelection,
  handleSetPlan,
  showCreditTypeSelection,
  promptCreditAmount,
  handleAddCredits,
  handleAddAllCredits,
  handleResetCredits,
  showUserJobs,
  showCreditPlanMenu,
  promptCpSearch,
  handleBulkPro,
  handleBulkCredits,
  showRevenue,
  showBroadcastMenu,
  promptBroadcast,
  executeBroadcast,
  cancelBroadcast,
  showApiKeyMenu,
  listApiKeys,
  showApiKeyDetail,
  promptAddApiKey,
  handleToggleApiKey,
  handleTestApiKey,
  handleDeleteApiKey,
  showApiKeyStats,
  showSystemInfo,
  handleAdminTextInput,
  // Legacy command handlers
  handleStatsCommand,
  handleAddCreditsCommand,
  handleSetPlanCommand,
  handleBanCommand,
  handleUnbanCommand,
  handleBroadcastCommand,
};
