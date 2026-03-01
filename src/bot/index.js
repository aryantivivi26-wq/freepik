'use strict';

const { Telegraf, session } = require('telegraf');
const { getRedis } = require('../utils/redis');
const { RedisSessionStore } = require('../utils/redisSessionStore');

const config = require('../config');
const { userMiddleware, sessionMiddleware, adminOnly } = require('./handlers/middleware');
const { sendMainMenu } = require('./menus/mainMenu');
const { formatUserProfile } = require('../utils/userHelper');

// ── Flow handlers ──────────────────────────────────────
const { startImageFlow, handleImageModel, handleImageRatio, handleImagePrompt, confirmImageGeneration } = require('./handlers/imageHandler');
const { startVideoFlow, handleVideoModel, handleVideoRatio, handleVideoDuration, handleVideoPrompt, confirmVideoGeneration } = require('./handlers/videoHandler');
const { startMusicFlow, handleMusicDuration, handleMusicPrompt, confirmMusicGeneration } = require('./handlers/musicHandler');
const { startTTSFlow, handleTTSVoice, handleTTSPrompt, confirmTTSGeneration } = require('./handlers/ttsHandler');
const { startSfxFlow, handleSfxDuration, handleSfxPrompt, confirmSfxGeneration } = require('./handlers/sfxHandler');
const { startImageEditFlow, handleEditTool, handleUpscaleScale, handleEditPhoto, confirmImageEdit } = require('./handlers/imageEditHandler');
const { showPlans, handleBuyPlan, handleCheckPayment, handleCancelPayment } = require('./handlers/paymentHandler');
const admin = require('./handlers/adminHandler');

function createBot() {
  const bot = new Telegraf(config.bot.token);

  const sessionStore = new RedisSessionStore(getRedis(), {
    prefix: 'tgbot:sess:',
    ttl: 86400,
  });

  bot.use(
    session({
      store: sessionStore,
      defaultSession: () => ({
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
      }),
    })
  );

  bot.use(sessionMiddleware);
  bot.use(userMiddleware);

  // ── ADMIN COMMAND ───────────────────────────────────
  bot.command('admin', adminOnly(config), async (ctx) => {
    await admin.showAdminMenu(ctx);
  });

  // ────────────────────────────────────────────────────
  // COMMANDS
  // ────────────────────────────────────────────────────

  bot.command('start', async (ctx) => {
    const name = ctx.from.first_name || 'Pengguna';
    const welcome =
      `✦ *Hubify Studio* — AI Creative Platform\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Halo, *${name}*! 👋\n\n` +
      `🎬 *Video Generator*\n` +
      `  Kling v3 Pro/Std · Kling Omni Pro/Std\n` +
      `  Runway Gen 4.5 · Wan 2.5 · Seedance 1.5 Pro\n\n` +
      `🎨 *Image Generator*\n` +
      `  Classic Fast · Mystic 2K · Flux Dev\n` +
      `  Flux 2 Pro · Flux 2 Klein · Flux Kontext Pro\n` +
      `  HyperFlux · Seedream v4.5/v5 · Z-Image\n\n` +
      `🖌 *Image Editing*\n` +
      `  Upscale HD · Remove Background\n` +
      `  Reimagine · Relight\n\n` +
      `🔊 *Text-to-Speech* (ElevenLabs)\n` +
      `  Multiple voices · Natural speech\n\n` +
      `🎵 *Music Generator*\n` +
      `  Original AI music · 15–60s duration\n\n` +
      `🎧 *Sound Effects*\n` +
      `  AI-generated SFX · 5–22s duration\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Pilih kategori dari menu di bawah untuk memulai.`;

    ctx.session.step = 'main_menu';
    await sendMainMenu(ctx, welcome);
  });

  bot.command('menu', async (ctx) => {
    ctx.session.step = 'main_menu';
    await sendMainMenu(ctx);
  });

  bot.command('profile', async (ctx) => {
    const user = ctx.state.user;
    if (!user) return ctx.reply('Profil tidak ditemukan.');
    await ctx.reply(formatUserProfile(user), { parse_mode: 'Markdown' });
  });

  bot.command('help', (ctx) => {
    const user = ctx.state.user;
    const plan = user ? user.plan.toUpperCase() : 'FREE';
    const c = user ? user.credits : { image: 0, video: 0, music: 0, sfx: 0, tts: 0 };
    return ctx.reply(
      `ℹ️ *Hubify Studio — Help*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Status Akun*\n` +
      `  Plan: *${plan}*\n` +
      `  🎨 Image: ${c.image} · 🎬 Video: ${c.video}\n` +
      `  🎵 Music: ${c.music} · 🎧 SFX: ${c.sfx} · 🔊 TTS: ${c.tts}\n\n` +
      `*Cara Pakai*\n` +
      `  1. Pilih kategori dari menu\n` +
      `  2. Pilih model & opsi\n` +
      `  3. Kirim prompt → tunggu hasil\n\n` +
      `*Info*\n` +
      `  • 1 credit = 1 generasi\n` +
      `  • Credit refund otomatis jika gagal\n` +
      `  • Maks 3 job aktif bersamaan\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `/menu — Buka menu · /profile — Lihat profil`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('cancel', async (ctx) => {
    ctx.session.step = 'main_menu';
    ctx.session.type = null;
    ctx.session.selectedModel = null;
    ctx.session.selectedRatio = null;
    ctx.session.selectedDuration = null;
    ctx.session.selectedVoice = null;
    ctx.session.prompt = null;
    ctx.session.editTool = null;
    ctx.session.editScale = null;
    ctx.session.editImageFileId = null;
    await ctx.reply('✅ Operasi dibatalkan.');
    await sendMainMenu(ctx);
  });

  // ── ADMIN COMMANDS (legacy + interactive) ─────────
  const adminGuard = adminOnly(config);

  bot.command('stats', adminGuard, admin.handleStatsCommand);
  bot.command('addcredits', adminGuard, admin.handleAddCreditsCommand);
  bot.command('setplan', adminGuard, admin.handleSetPlanCommand);
  bot.command('ban', adminGuard, admin.handleBanCommand);
  bot.command('unban', adminGuard, admin.handleUnbanCommand);
  bot.command('broadcast', adminGuard, admin.handleBroadcastCommand);

  // ── ADMIN INLINE PANEL CALLBACKS ──────────────────
  const isAdmin = (ctx) => Number(ctx.from?.id) === Number(config.bot.adminId);

  bot.action('admin:menu', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showAdminMenu(ctx);
  });

  bot.action('admin:stats', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showStats(ctx);
  });

  // ── User Management ────────────────────────────────
  bot.action('admin:users', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showUserManagement(ctx);
  });

  bot.action('admin:user_search', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptUserSearch(ctx);
  });

  bot.action('admin:user_subs', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listSubscribers(ctx, 0);
  });

  bot.action('admin:user_all', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listAllUsers(ctx, 0);
  });

  bot.action('admin:user_banned', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listBannedUsers(ctx, 0);
  });

  bot.action('admin:user_recent', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listRecentUsers(ctx);
  });

  bot.action(/^admin:userdetail:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showUserDetail(ctx, ctx.match[1]);
  });

  bot.action(/^admin:ban:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleBan(ctx, ctx.match[1]);
  });

  bot.action(/^admin:unban:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleUnban(ctx, ctx.match[1]);
  });

  bot.action(/^admin:setplan:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showPlanSelection(ctx, ctx.match[1]);
  });

  bot.action(/^admin:dosetplan:(\d+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleSetPlan(ctx, ctx.match[1], ctx.match[2]);
  });

  bot.action(/^admin:addcred:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showCreditTypeSelection(ctx, ctx.match[1]);
  });

  bot.action(/^admin:credtype:(\d+):(\w+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptCreditAmount(ctx, ctx.match[1], ctx.match[2]);
  });

  bot.action(/^admin:credall:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleAddAllCredits(ctx, ctx.match[1]);
  });

  bot.action(/^admin:resetcred:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleResetCredits(ctx, ctx.match[1]);
  });

  bot.action(/^admin:userjobs:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showUserJobs(ctx, ctx.match[1]);
  });

  // ── Pagination ─────────────────────────────────────
  bot.action(/^admin:subspage:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listSubscribers(ctx, parseInt(ctx.match[1], 10));
  });

  bot.action(/^admin:allpage:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listAllUsers(ctx, parseInt(ctx.match[1], 10));
  });

  bot.action(/^admin:bannedpage:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listBannedUsers(ctx, parseInt(ctx.match[1], 10));
  });

  // ── Credit & Plan (Bulk) ───────────────────────────
  bot.action('admin:credits', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showCreditPlanMenu(ctx);
  });

  bot.action('admin:cp_search', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptCpSearch(ctx);
  });

  bot.action('admin:bulk_pro', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleBulkPro(ctx);
  });

  bot.action('admin:bulk_credits', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleBulkCredits(ctx);
  });

  bot.action('admin:revenue', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showRevenue(ctx);
  });

  // ── Broadcast ──────────────────────────────────────
  bot.action('admin:broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showBroadcastMenu(ctx);
  });

  bot.action('admin:bc_all', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptBroadcast(ctx, 'all');
  });

  bot.action('admin:bc_subs', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptBroadcast(ctx, 'subs');
  });

  bot.action('admin:bc_free', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptBroadcast(ctx, 'free');
  });

  bot.action('admin:bc_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.executeBroadcast(ctx);
  });

  bot.action('admin:bc_cancel', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.cancelBroadcast(ctx);
  });

  // ── API Key Management ─────────────────────────────
  bot.action('admin:apikeys', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showApiKeyMenu(ctx);
  });

  bot.action('admin:ak_list', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.listApiKeys(ctx);
  });

  bot.action('admin:ak_add', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.promptAddApiKey(ctx);
  });

  bot.action('admin:ak_stats', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showApiKeyStats(ctx);
  });

  bot.action(/^admin:ak_detail:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showApiKeyDetail(ctx, ctx.match[1]);
  });

  bot.action(/^admin:ak_toggle:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleToggleApiKey(ctx, ctx.match[1]);
  });

  bot.action(/^admin:ak_test:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleTestApiKey(ctx, ctx.match[1]);
  });

  bot.action(/^admin:ak_delete:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await admin.handleDeleteApiKey(ctx, ctx.match[1]);
  });

  // ── System Info ────────────────────────────────────
  bot.action('admin:system', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await admin.showSystemInfo(ctx);
  });

  // ── Noop (pagination page counter) ─────────────────
  bot.action('noop', (ctx) => ctx.answerCbQuery());

  // ────────────────────────────────────────────────────
  // MAIN MENU INLINE BUTTON HANDLERS
  // ────────────────────────────────────────────────────

  bot.action('menu:image', async (ctx) => {
    await ctx.answerCbQuery();
    await startImageFlow(ctx);
  });

  bot.action('menu:video', async (ctx) => {
    await ctx.answerCbQuery();
    await startVideoFlow(ctx);
  });

  bot.action('menu:music', async (ctx) => {
    await ctx.answerCbQuery();
    await startMusicFlow(ctx);
  });

  bot.action('menu:sfx', async (ctx) => {
    await ctx.answerCbQuery();
    await startSfxFlow(ctx);
  });

  bot.action('menu:tts', async (ctx) => {
    await ctx.answerCbQuery();
    await startTTSFlow(ctx);
  });

  bot.action('menu:image_edit', async (ctx) => {
    await ctx.answerCbQuery();
    await startImageEditFlow(ctx);
  });

  bot.action('menu:profile', async (ctx) => {
    await ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return ctx.reply('Profil tidak ditemukan.');
    await ctx.reply(formatUserProfile(user), { parse_mode: 'Markdown' });
  });

  bot.action('menu:upgrade', async (ctx) => {
    await ctx.answerCbQuery();
    await showPlans(ctx);
  });

  bot.action('menu:help', async (ctx) => {
    await ctx.answerCbQuery();
    const user = ctx.state.user;
    const plan = user ? user.plan.toUpperCase() : 'FREE';
    const c = user ? user.credits : { image: 0, video: 0, music: 0, sfx: 0, tts: 0 };
    await ctx.reply(
      `ℹ️ *Hubify Studio — Help*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Status Akun*\n` +
      `  Plan: *${plan}*\n` +
      `  🎨 Image: ${c.image} · 🎬 Video: ${c.video}\n` +
      `  🎵 Music: ${c.music} · 🎧 SFX: ${c.sfx} · 🔊 TTS: ${c.tts}\n\n` +
      `*Plans*\n` +
      `  🆓 Free — Image×5 · Video×2 · Music×3 · SFX×5 · TTS×10\n` +
      `  🚀 Pro (Rp29k) — 50/20/30/50/100\n` +
      `  ♾️ Unlimited (Rp79k) — Semua unlimited\n\n` +
      `*Info*\n` +
      `  • 1 credit = 1 generasi\n` +
      `  • Credit refund otomatis jika gagal\n` +
      `  • Maks 3 job aktif bersamaan\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `/menu — Buka menu · /profile — Lihat profil`,
      { parse_mode: 'Markdown' }
    );
  });

  // ────────────────────────────────────────────────────
  // CALLBACK QUERY HANDLERS
  // ────────────────────────────────────────────────────

  // ── Image model selection ──────────────────────────
  bot.action(/^img_model:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleImageModel(ctx, ctx.match[1]);
  });

  // ── Image ratio selection ──────────────────────────
  bot.action(/^img_ratio:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleImageRatio(ctx, ctx.match[1]);
  });

  // ── Video model selection ──────────────────────────
  bot.action(/^vid_model:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleVideoModel(ctx, ctx.match[1]);
  });

  // ── Video ratio selection ──────────────────────────
  bot.action(/^vid_ratio:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleVideoRatio(ctx, ctx.match[1]);
  });

  // ── Video duration selection ───────────────────────
  bot.action(/^vid_dur:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleVideoDuration(ctx, ctx.match[1]);
  });

  // ── Music duration selection ───────────────────────
  bot.action(/^music_dur:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleMusicDuration(ctx, ctx.match[1]);
  });

  // ── SFX duration selection ─────────────────────────
  bot.action(/^sfx_dur:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleSfxDuration(ctx, ctx.match[1]);
  });

  // ── TTS voice selection ────────────────────────────
  bot.action(/^tts_voice:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleTTSVoice(ctx, ctx.match[1]);
  });

  // ── Confirm generation ─────────────────────────────
  bot.action('confirm:image', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmImageGeneration(ctx);
  });

  bot.action('confirm:video', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmVideoGeneration(ctx);
  });

  bot.action('confirm:music', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmMusicGeneration(ctx);
  });

  bot.action('confirm:sfx', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmSfxGeneration(ctx);
  });

  bot.action('confirm:tts', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmTTSGeneration(ctx);
  });

  // ── Image Editing callbacks ────────────────────────
  bot.action(/^imgedit:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const tool = ctx.match[1];
    if (tool === 'back_tool') {
      return startImageEditFlow(ctx);
    }
    await handleEditTool(ctx, tool);
  });

  bot.action(/^imgedit_scale:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleUpscaleScale(ctx, ctx.match[1]);
  });

  bot.action('confirm:imgedit', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmImageEdit(ctx);
  });

  // ── Edit prompt ────────────────────────────────────
  bot.action('edit:prompt', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.step = 'awaiting_prompt';
    await ctx.editMessageText(
      '✏️ Kirim ulang prompt/teks yang baru:',
      { parse_mode: 'Markdown' }
    );
  });

  // ── Back navigation ────────────────────────────────
  bot.action('back:main', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.step = 'main_menu';
    ctx.session.type = null;
    await ctx.editMessageText('🏠 Kembali ke menu utama.').catch(() => {});
    await sendMainMenu(ctx);
  });

  bot.action('back:image_model', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.step = 'select_model';
    const { imageModelKeyboard } = require('./menus/imageMenu');
    await ctx.editMessageText(
      '🖼 *Generate Gambar AI*\n\nPilih model yang ingin kamu gunakan:',
      { parse_mode: 'Markdown', ...imageModelKeyboard() }
    );
  });

  bot.action('back:video_model', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.step = 'select_model';
    const { videoModelKeyboard } = require('./menus/videoMenu');
    await ctx.editMessageText(
      '🎬 *Generate Video AI*\n\nPilih model yang ingin kamu gunakan:',
      { parse_mode: 'Markdown', ...videoModelKeyboard() }
    );
  });

  bot.action('back:video_ratio', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.step = 'select_ratio';
    const model = ctx.session.selectedModel;
    const { videoModelKeyboard } = require('./menus/videoMenu');
    // Go back to model selection if model context lost
    if (!model) {
      await ctx.editMessageText(
        '🎬 *Generate Video AI*\n\nPilih model yang ingin kamu gunakan:',
        { parse_mode: 'Markdown', ...videoModelKeyboard() }
      );
      return;
    }
    // Show the correct ratio keyboard for the selected model
    const handler = require('./handlers/videoHandler');
    await handleVideoModel(ctx, model);
  });

  // ── Payment handlers ───────────────────────────────
  bot.action(/^buy_plan:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleBuyPlan(ctx, ctx.match[1]);
  });

  bot.action(/^check_payment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('🔄 Mengecek status pembayaran...');
    await handleCheckPayment(ctx, ctx.match[1]);
  });

  bot.action(/^cancel_payment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleCancelPayment(ctx, ctx.match[1]);
  });

  // ────────────────────────────────────────────────────
  // PHOTO HANDLER (image editing)
  // ────────────────────────────────────────────────────

  bot.on('photo', async (ctx) => {
    const consumed = await handleEditPhoto(ctx);
    if (!consumed) {
      await ctx.reply('📷 Untuk mengedit gambar, buka *🖌 Image Editing* dari /menu dulu.', { parse_mode: 'Markdown' });
    }
  });

  // ────────────────────────────────────────────────────
  // TEXT MESSAGE HANDLER (prompt capture)
  // ────────────────────────────────────────────────────

  bot.on('text', async (ctx) => {
    if (!ctx.message.text || ctx.message.text.startsWith('/')) return;

    // Admin text input handler (search, credits, broadcast, api keys, etc.)
    if (Number(ctx.from?.id) === Number(config.bot.adminId) && ctx.session.adminStep) {
      const consumed = await admin.handleAdminTextInput(ctx);
      if (consumed) return;
    }

    const step = ctx.session.step;
    const type = ctx.session.type;

    if (step !== 'awaiting_prompt') return;

    if (type === 'image') return handleImagePrompt(ctx);
    if (type === 'video') return handleVideoPrompt(ctx);
    if (type === 'music') return handleMusicPrompt(ctx);
    if (type === 'sfx')   return handleSfxPrompt(ctx);
    if (type === 'tts')   return handleTTSPrompt(ctx);
  });

  // ────────────────────────────────────────────────────
  // ERROR HANDLER
  // ────────────────────────────────────────────────────

  bot.catch(async (err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err.message);
    try {
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi atau ketuk /menu.');
    } catch (_) {}
  });

  return bot;
}

module.exports = { createBot };
