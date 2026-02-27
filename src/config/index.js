'use strict';

require('dotenv').config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
    adminId: parseInt(process.env.ADMIN_ID, 10),
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-bot',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  freepik: {
    apiKey: process.env.FREEPIK_API_KEY,
    baseUrl: 'https://api.freepik.com/v1',
  },
  hubify: {
    apiKey: process.env.HUBIFY_API_KEY,
    webhookSecret: process.env.HUBIFY_WEBHOOK_SECRET,
    baseUrl: process.env.HUBIFY_BASE_URL || 'https://qris.hubify.store/api',
  },
  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT, 10) || 3001,
    publicUrl: process.env.WEBHOOK_PUBLIC_URL,
  },
  paths: {
    uploads: process.env.UPLOAD_DIR || './uploads',
    temp: process.env.TEMP_DIR || './temp',
  },
  bullmq: {
    maxActiveJobsPerUser: parseInt(process.env.MAX_ACTIVE_JOBS_PER_USER, 10) || 3,
  },
  plans: {
    free: {
      name: 'Free',
      price: 0,
      credits: { image: 5, video: 2, music: 3, tts: 10 },
      durationDays: null,
    },
    pro: {
      name: 'Pro',
      price: 29000,
      credits: { image: 50, video: 20, music: 30, tts: 100 },
      durationDays: 30,
    },
    unlimited: {
      name: 'Unlimited',
      price: 79000,
      credits: { image: 9999, video: 9999, music: 9999, tts: 9999 },
      durationDays: 30,
    },
  },
  polling: {
    maxAttempts: 40,
    intervalMs: 3000,
  },
};

module.exports = config;
