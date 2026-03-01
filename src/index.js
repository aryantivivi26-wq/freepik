'use strict';

require('dotenv').config();

const config = require('./config');
const { connectDB } = require('./models');
const { getRedis } = require('./utils/redis');
const { ensureDirs } = require('./utils/fileHelper');
const { createBot } = require('./bot');
const { startWebhookServer } = require('./services/webhookServer');

const APP_VERSION = '1.1.0';

async function main() {
  console.log(`🤖 Starting Telegram AI Generator Bot v${APP_VERSION}...`);

  // ── Validate required env vars ────────────────────────
  const required = ['BOT_TOKEN', 'MONGODB_URI', 'FREEPIK_API_KEY', 'HUBIFY_API_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  // ── Connect to MongoDB ────────────────────────────────
  await connectDB();

  // ── Connect to Redis (eager) ──────────────────────────
  const redis = getRedis();
  try {
    await redis.connect();
  } catch (err) {
    // If already connected (lazyConnect triggered), ignore; otherwise warn
    if (err.message && !err.message.includes('already')) {
      console.warn('[Redis] Initial connect warning:', err.message);
    }
  }

  // ── Ensure upload/temp directories exist ─────────────
  await ensureDirs();

  // ── Create and start bot ──────────────────────────────
  const bot = createBot();

  // ── Start Express webhook server ──────────────────────
  startWebhookServer(bot);

  // ── Set bot command menu ──────────────────────────────
  const userCommands = [
    { command: 'start', description: 'Mulai bot & lihat info' },
    { command: 'menu', description: 'Buka menu utama' },
    { command: 'profile', description: 'Lihat profil & credit' },
    { command: 'help', description: 'Bantuan & info akses' },
    { command: 'cancel', description: 'Batalkan operasi' },
  ];

  const adminCommands = [
    ...userCommands,
    { command: 'admin', description: '🛡 Admin Panel' },
    { command: 'stats', description: '📊 Statistik bot' },
    { command: 'broadcast', description: '📢 Broadcast pesan' },
  ];

  await bot.telegram.setMyCommands(userCommands);
  if (config.bot.adminId) {
    await bot.telegram.setMyCommands(adminCommands, {
      scope: { type: 'chat', chat_id: config.bot.adminId },
    });
  }

  // ── Launch bot (long polling) ─────────────────────────
  await bot.launch({
    allowedUpdates: ['message', 'callback_query'],
  });

  console.log('✅ Bot started successfully (long polling)');
  console.log(`📊 Admin ID: ${config.bot.adminId}`);
  console.log(`🌐 Webhook server: http://localhost:${config.webhook.port}`);

  // ── Graceful shutdown ─────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[Main] ${signal} received. Shutting down gracefully...`);
    bot.stop(signal);
    try { await redis.quit(); } catch (_) {}
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Fatal error during startup:', err);
  process.exit(1);
});
