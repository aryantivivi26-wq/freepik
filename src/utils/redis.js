'use strict';

const { Redis } = require('ioredis');
const config = require('../config');

let redisClient = null;

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => console.log('[Redis] Connected'));
    redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));
    redisClient.on('reconnecting', () => console.warn('[Redis] Reconnecting...'));
  }
  return redisClient;
}

/**
 * Rate-limit helper: track active job count per user.
 */
async function getUserActiveJobs(userId) {
  const redis = getRedis();
  const val = await redis.get(`active_jobs:${userId}`);
  return parseInt(val || '0', 10);
}

async function incrementActiveJobs(userId) {
  const redis = getRedis();
  return redis.incr(`active_jobs:${userId}`);
}

async function decrementActiveJobs(userId) {
  const redis = getRedis();
  const val = await redis.decr(`active_jobs:${userId}`);
  if (val < 0) await redis.set(`active_jobs:${userId}`, 0);
  return Math.max(val, 0);
}

async function setActiveJobs(userId, count) {
  const redis = getRedis();
  return redis.set(`active_jobs:${userId}`, Math.max(count, 0));
}

module.exports = {
  getRedis,
  getUserActiveJobs,
  incrementActiveJobs,
  decrementActiveJobs,
  setActiveJobs,
};
