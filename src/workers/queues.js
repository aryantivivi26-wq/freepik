'use strict';

const { Queue } = require('bullmq');
const { getRedis } = require('../utils/redis');

let imageQueue = null;
let videoQueue = null;
let musicQueue = null;
let ttsQueue = null;

const QUEUE_NAMES = {
  IMAGE: 'image-generation',
  VIDEO: 'video-generation',
  MUSIC: 'music-generation',
  TTS:   'tts-generation',
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

function getConnection() {
  return getRedis();
}

function getImageQueue() {
  if (!imageQueue) {
    imageQueue = new Queue(QUEUE_NAMES.IMAGE, { connection: getConnection() });
  }
  return imageQueue;
}

function getVideoQueue() {
  if (!videoQueue) {
    videoQueue = new Queue(QUEUE_NAMES.VIDEO, { connection: getConnection() });
  }
  return videoQueue;
}

function getMusicQueue() {
  if (!musicQueue) {
    musicQueue = new Queue(QUEUE_NAMES.MUSIC, { connection: getConnection() });
  }
  return musicQueue;
}

function getTTSQueue() {
  if (!ttsQueue) {
    ttsQueue = new Queue(QUEUE_NAMES.TTS, { connection: getConnection() });
  }
  return ttsQueue;
}

/**
 * Add a generation job to the appropriate queue.
 * @param {string} type - 'image'|'video'|'music'|'tts'
 * @param {object} payload - { userId, chatId, messageId, prompt, model, options, priority }
 * @returns {Job} BullMQ job
 */
async function enqueueJob(type, payload) {
  // NOTE: jobId intentionally NOT set in BullMQ options — using payload.jobId only
  // as a reference in the job data. Setting jobId in options causes BullMQ to
  // treat it as a deduplication key and silently drop duplicate submissions.
  const jobOpts = {
    ...DEFAULT_JOB_OPTIONS,
    priority: payload.priority || 0,
  };

  switch (type) {
    case 'image': return getImageQueue().add('generate', payload, jobOpts);
    case 'video': return getVideoQueue().add('generate', payload, jobOpts);
    case 'music': return getMusicQueue().add('generate', payload, jobOpts);
    case 'tts':   return getTTSQueue().add('generate', payload, jobOpts);
    default:      throw new Error(`Unknown job type: ${type}`);
  }
}

module.exports = {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  getImageQueue,
  getVideoQueue,
  getMusicQueue,
  getTTSQueue,
  enqueueJob,
};
