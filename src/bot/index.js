'use strict';

const { Telegraf, session } = require('telegraf');
const { Redis: IORedis } = require('ioredis');
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
const { showPlans, handleBuyPlan, handleCheckPayment, handleCancelPayment } = require('./handlers/paymentHandler');
const { handleStats, handleAddCredits, handleSetPlan, handleBan, handleUnban, handleBroadcast } = require('./handlers/adminHandler');

function createBot() {
  const bot = new Telegraf(config.bot.token);

  // ── Redis session store ──────────────────────────────
  const redisClient = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  const sessionStore = new RedisSessionStore(redisClient, {
    prefix: 'tgbot:sess:',
    ttl: 86400, // 24h
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
      }),
    })
  );

  // ── Custom middleware ────────────────────────────────
  bot.use(sessionMiddleware);
  bot.use(userMiddleware);

  // ────────────────────────────────────────────────────
  // COMMANDS
  // ────────────────────────────────────────────────────

  bot.command('start', async (ctx) => {
    const name = ctx.from.first_name || 'Pengguna';
    await ctx.reply(
      `👋 Halo, *${name}*!\n\n` +
      `Selamat datang di *AI Generator Bot* 🤖\n\n` +
      `Bot ini menggunakan teknologi AI terdepan untuk membantu kamu:\n` +
      `🖼 Generate gambar berkualitas tinggi\n` +
      `🎬 Buat video AI yang menakjubkan\n` +
      `🎵 Compose musik original\n` +
      `🔊 Text-to-speech dengan suara natural\n\n` +
      `Gunakan menu di bawah untuk memulai!`,
      { parse_mode: 'Markdown' }
    );
    ctx.session.step = 'main_menu';
    await sendMainMenu(ctx);
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
    return ctx.reply(
      `❓ *Bantuan*\n\n` +
      `*Cara penggunaan:*\n` +
      `1. Pilih jenis konten dari menu\n` +
      `2. Pilih model & opsi\n` +
      `3. Kirim prompt/teks\n` +
      `4. Tunggu hasilnya!\n\n` +
      `*Credit sistem:*\n` +
      `Setiap generasi membutuhkan 1 credit.\n` +
      `Credit dikembalikan jika generasi gagal.\n\n` +
      `*Rate limit:*\n` +
      `Maksimal 3 job aktif per waktu.\n\n` +
      `*Butuh bantuan?* Hubungi admin bot ini.`,
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
    await ctx.reply('✅ Operasi dibatalkan.');
    await sendMainMenu(ctx);
  });

  // ── ADMIN COMMANDS ─────────────────────────────────
  const adminGuard = adminOnly(config);

  bot.command('stats', adminGuard, handleStats);
  bot.command('addcredits', adminGuard, handleAddCredits);
  bot.command('setplan', adminGuard, handleSetPlan);
  bot.command('ban', adminGuard, handleBan);
  bot.command('unban', adminGuard, handleUnban);
  bot.command('broadcast', adminGuard, handleBroadcast);

  // ────────────────────────────────────────────────────
  // KEYBOARD BUTTON HANDLERS (text messages)
  // ────────────────────────────────────────────────────

  bot.hears('🖼 Generate Gambar', startImageFlow);
  bot.hears('🎬 Generate Video', startVideoFlow);
  bot.hears('🎵 Generate Musik', startMusicFlow);
  bot.hears('🔊 Text-to-Speech', startTTSFlow);

  bot.hears('👤 Profil Saya', async (ctx) => {
    const user = ctx.state.user;
    if (!user) return ctx.reply('Profil tidak ditemukan.');
    await ctx.reply(formatUserProfile(user), { parse_mode: 'Markdown' });
  });

  bot.hears('💎 Upgrade Plan', showPlans);

  bot.hears('❓ Bantuan', (ctx) => ctx.reply(
    `❓ *Bantuan*\n\n` +
    `*Cara penggunaan:*\n` +
    `1. Pilih jenis konten dari menu\n` +
    `2. Pilih model & opsi\n` +
    `3. Kirim prompt/teks\n` +
    `4. Tunggu hasilnya!\n\n` +
    `*Credit sistem:*\n` +
    `Setiap generasi membutuhkan 1 credit.\n` +
    `Credit dikembalikan jika generasi gagal.\n\n` +
    `*Rate limit:*\n` +
    `Maksimal 3 job aktif per waktu.\n\n` +
    `*Plans:*\n` +
    `🆓 Free: Image×5, Video×2, Music×3, TTS×10\n` +
    `🚀 Pro (Rp29k): Image×50, Video×20, Music×30, TTS×100\n` +
    `♾️ Unlimited (Rp79k): Semua unlimited`,
    { parse_mode: 'Markdown' }
  ));

  // ────────────────────────────────────────────────────
  // CALLBACK QUERY HANDLERS
  // ────────────────────────────────────────────────────

  // ── Image model selection ──────────────────────────
  bot.action(/^img_model:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const model = ctx.match[1]; // 'classic_fast' | 'mystic'
    await handleImageModel(ctx, model);
  });

  // ── Image ratio selection ──────────────────────────
  bot.action(/^img_ratio:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ratio = ctx.match[1];
    await handleImageRatio(ctx, ratio);
  });

  // ── Video model selection ──────────────────────────
  bot.action(/^vid_model:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const model = ctx.match[1]; // 'kling_pro' | 'kling_std'
    await handleVideoModel(ctx, model);
  });

  // ── Video ratio selection ──────────────────────────
  bot.action(/^vid_ratio:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ratio = ctx.match[1];
    await handleVideoRatio(ctx, ratio);
  });

  // ── Video duration selection ───────────────────────
  bot.action(/^vid_dur:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const duration = ctx.match[1];
    await handleVideoDuration(ctx, duration);
  });

  // ── Music duration selection ───────────────────────
  bot.action(/^music_dur:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const duration = ctx.match[1];
    await handleMusicDuration(ctx, duration);
  });

  // ── TTS voice selection ────────────────────────────
  bot.action(/^tts_voice:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const voice = ctx.match[1];
    await handleTTSVoice(ctx, voice);
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

  bot.action('confirm:tts', async (ctx) => {
    await ctx.answerCbQuery();
    await confirmTTSGeneration(ctx);
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
    const { videoRatioKeyboard } = require('./menus/videoMenu');
    await ctx.editMessageText(
      `🎬 *Generate Video AI*\n\nPilih rasio video:`,
      { parse_mode: 'Markdown', ...videoRatioKeyboard() }
    );
  });

  // ── Payment handlers ───────────────────────────────
  bot.action(/^buy_plan:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const plan = ctx.match[1];
    await handleBuyPlan(ctx, plan);
  });

  bot.action(/^check_payment:(.+)$/, async (ctx) => {
    const transactionId = ctx.match[1];
    await handleCheckPayment(ctx, transactionId);
  });

  bot.action(/^cancel_payment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const transactionId = ctx.match[1];
    await handleCancelPayment(ctx, transactionId);
  });

  // ────────────────────────────────────────────────────
  // TEXT MESSAGE HANDLER (prompt capture)
  // ────────────────────────────────────────────────────

  bot.on('text', async (ctx) => {
    const step = ctx.session.step;
    const type = ctx.session.type;

    if (step !== 'awaiting_prompt') return;

    if (!ctx.message.text || ctx.message.text.startsWith('/')) return;

    if (type === 'image') return handleImagePrompt(ctx);
    if (type === 'video') return handleVideoPrompt(ctx);
    if (type === 'music') return handleMusicPrompt(ctx);
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
