'use strict';

require('dotenv').config();

const config = require('./config');
const { connectDB } = require('./models');
const { getRedis } = require('./utils/redis');
const { ensureDirs } = require('./utils/fileHelper');
const { createBot } = require('./bot');
const { startWebhookServer } = require('./services/webhookServer');

async function main() {
  console.log('🤖 Starting Telegram AI Generator Bot...');

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
