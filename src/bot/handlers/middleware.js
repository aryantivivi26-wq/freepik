'use strict';

const { getOrCreateUser } = require('../../utils/userHelper');

/**
 * Attach user document to ctx.state.user on every update.
 */
async function userMiddleware(ctx, next) {
  if (!ctx.from) return next();

  try {
    const user = await getOrCreateUser(ctx);
    ctx.state.user = user;

    if (user.isBanned) {
      // Must answer callback queries or Telegram shows permanent spinner
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
      return ctx.reply('🚫 Akun kamu telah diblokir. Hubungi admin untuk informasi lebih lanjut.');
    }
  } catch (err) {
    console.error('[Middleware] userMiddleware error:', err.message);
  }

  return next();
}

/**
 * Initialize session defaults if fields are missing.
 */
async function sessionMiddleware(ctx, next) {
  if (!ctx.session) ctx.session = {};

  const defaults = {
    step: 'main_menu',
    type: null,
    selectedModel: null,
    selectedRatio: null,
    selectedDuration: null,
    selectedVoice: null,
    prompt: null,
    pendingJobId: null,
    pendingTransactionId: null,
    pendingPlan: null,
    // Admin panel session fields
    adminStep: null,
    adminTarget: null,
    adminCreditType: null,
    broadcastTarget: null,
    broadcastMessage: null,
    // Image editing session fields
    editTool: null,
    editScale: null,
    editImageFileId: null,
  };

  for (const [key, val] of Object.entries(defaults)) {
    if (ctx.session[key] === undefined) {
      ctx.session[key] = val;
    }
  }

  return next();
}

/**
 * Admin-only guard middleware.
 */
function adminOnly(config) {
  return async (ctx, next) => {
    const fromId = ctx.from?.id;
    const adminId = config.bot.adminId;
    if (!fromId || !adminId || Number(fromId) !== Number(adminId)) {
      return ctx.reply('⛔ Perintah ini hanya untuk admin.');
    }
    return next();
  };
}

module.exports = { userMiddleware, sessionMiddleware, adminOnly };
