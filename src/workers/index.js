'use strict';

require('dotenv').config();

const { Worker } = require('bullmq');
const { getRedis } = require('../utils/redis');
const { connectDB } = require('../models');
const { processJob } = require('./processor');
const { QUEUE_NAMES } = require('./queues');

const WORKER_VERSION = '1.1.0';

async function startWorkers() {
  console.log(`⚙️  Starting Worker v${WORKER_VERSION}...`);
  await connectDB();

  const connection = getRedis();

  const workerOptions = {
    connection,
    concurrency: 5,
  };

  const onCompleted = (job) => {
    console.log(`[BullMQ] Job completed: ${job.id} (${job.name})`);
  };

  const onFailed = (job, err) => {
    console.error(`[BullMQ] Job failed: ${job?.id} - ${err.message}`);
  };

  // Image Worker
  const imageWorker = new Worker(
    QUEUE_NAMES.IMAGE,
    (job) => processJob(job),
    workerOptions
  );
  imageWorker.on('completed', onCompleted);
  imageWorker.on('failed', onFailed);

  // Video Worker
  const videoWorker = new Worker(
    QUEUE_NAMES.VIDEO,
    (job) => processJob(job),
    { ...workerOptions, concurrency: 3 }
  );
  videoWorker.on('completed', onCompleted);
  videoWorker.on('failed', onFailed);

  // Music Worker
  const musicWorker = new Worker(
    QUEUE_NAMES.MUSIC,
    (job) => processJob(job),
    { ...workerOptions, concurrency: 3 }
  );
  musicWorker.on('completed', onCompleted);
  musicWorker.on('failed', onFailed);

  // TTS Worker
  const ttsWorker = new Worker(
    QUEUE_NAMES.TTS,
    (job) => processJob(job),
    { ...workerOptions, concurrency: 5 }
  );
  ttsWorker.on('completed', onCompleted);
  ttsWorker.on('failed', onFailed);

  console.log('[Workers] All workers started');
  console.log(`[Workers] Queues: ${Object.values(QUEUE_NAMES).join(', ')}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Workers] Shutting down...');
    await Promise.all([
      imageWorker.close(),
      videoWorker.close(),
      musicWorker.close(),
      ttsWorker.close(),
    ]);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorkers().catch((err) => {
  console.error('[Workers] Fatal error:', err);
  process.exit(1);
});
