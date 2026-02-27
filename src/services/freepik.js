'use strict';

const axios = require('axios');
const config = require('../config');
const { saveBase64ToFile, saveBufferToFile, downloadFile } = require('../utils/fileHelper');

const freepikClient = axios.create({
  baseURL: config.freepik.baseUrl,
  headers: {
    'x-freepik-api-key': config.freepik.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// ─────────────────────────────────────────
// POLLING HELPER
// ─────────────────────────────────────────

/**
 * Universal poller for async Freepik tasks.
 * @param {Function} checkFn - async () => response.data
 * @param {string} taskId - for logging
 * @returns {object} final response data when status is DONE
 */
async function pollUntilDone(checkFn, taskId) {
  const { maxAttempts, intervalMs } = config.polling;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const data = await checkFn();
    const status = (data.status || '').toUpperCase();

    console.log(`[Freepik] Poll ${taskId} attempt ${attempt}/${maxAttempts}: ${status}`);

    if (status === 'DONE') return data;
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`Task ${taskId} failed with status: ${status}`);
    }

    // CREATED | IN_PROGRESS | PENDING -> wait
    await sleep(intervalMs);
  }

  throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ─────────────────────────────────────────
// IMAGE — Classic Fast (SYNCHRONOUS)
// ─────────────────────────────────────────

const SIZE_MAP = {
  square_1_1:    'square_1_1',
  portrait_3_4:  'portrait_3_4',
  landscape_4_3: 'landscape_4_3',
  portrait_9_16: 'portrait_9_16',
  landscape_16_9:'landscape_16_9',
};

/**
 * Generate image using Classic Fast model (synchronous, returns base64).
 * @param {string} prompt
 * @param {string} size - one of SIZE_MAP keys
 * @returns {string} local file path
 */
async function generateImageClassic(prompt, size = 'square_1_1') {
  const imageSize = SIZE_MAP[size] || 'square_1_1';

  const response = await freepikClient.post('/ai/text-to-image', {
    prompt,
    negative_prompt: 'blur, distort, low quality, ugly, watermark',
    guidance_scale: 2,
    num_images: 1,
    seed: 42,
    image: { size: imageSize },
    styling: {
      style: 'photo',
      effects: { color: 'auto', lighting: 'auto', framing: 'auto' },
    },
    filter_nsfw: true,
  });

  const imageData = response.data?.data?.[0];
  if (!imageData) throw new Error('No image data returned from Classic Fast');

  if (imageData.has_nsfw) throw new Error('NSFW content detected, generation rejected');

  const buffer = Buffer.from(imageData.base64, 'base64');
  const filePath = await saveBufferToFile(buffer, 'jpg');
  return filePath;
}

// ─────────────────────────────────────────
// IMAGE — Mystic 2K (ASYNC)
// ─────────────────────────────────────────

/**
 * Generate image using Mystic 2K model (async, polling).
 * @param {string} prompt
 * @returns {string} local file path
 */
async function generateImageMystic(prompt) {
  const createRes = await freepikClient.post('/ai/mystic', {
    prompt,
    negative_prompt: 'blur, distort, low quality, ugly, watermark',
    resolution: '2k',
    detail_level: 0.5,
    filter_nsfw: true,
  });

  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error('No task_id returned from Mystic');

  console.log(`[Freepik] Mystic task created: ${taskId}`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`/ai/mystic/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const imageUrl = result.generated?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in Mystic result');

  const filePath = await downloadFile(imageUrl, 'jpg');
  return filePath;
}

// ─────────────────────────────────────────
// VIDEO — Kling v3 Pro / Std (ASYNC)
// ─────────────────────────────────────────

/**
 * Generate video using Kling v3.
 * @param {string} prompt
 * @param {object} options - { model: 'pro'|'std', aspectRatio, duration }
 * @returns {string} local file path
 */
async function generateVideo(prompt, options = {}) {
  const model = options.model === 'std' ? 'kling-v3' : 'kling-v3-pro';
  const aspect_ratio = options.aspectRatio || '16:9';
  const duration = String(options.duration || '5');

  const createRes = await freepikClient.post(`/ai/video/${model}`, {
    prompt,
    aspect_ratio,
    duration,
    generate_audio: true,
    negative_prompt: 'blur, distort, low quality',
  });

  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error(`No task_id returned from Kling ${model}`);

  console.log(`[Freepik] Video task created: ${taskId} (model: ${model})`);

  // Poll endpoint is always /kling-v3/{task_id} regardless of pro/std
  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`/ai/video/kling-v3/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const videoUrl = result.generated?.[0]?.url;
  if (!videoUrl) throw new Error('No video URL in Kling result');

  const filePath = await downloadFile(videoUrl, 'mp4');
  return filePath;
}

// ─────────────────────────────────────────
// MUSIC (ASYNC)
// ─────────────────────────────────────────

/**
 * Generate music.
 * @param {string} prompt
 * @param {number} durationSeconds - 15 | 30 | 60
 * @returns {string} local file path
 */
async function generateMusic(prompt, durationSeconds = 30) {
  const allowed = [15, 30, 60];
  const length = allowed.includes(durationSeconds) ? durationSeconds : 30;

  const createRes = await freepikClient.post('/ai/music-generation', {
    prompt,
    music_length_seconds: length,
  });

  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error('No task_id returned from music-generation');

  console.log(`[Freepik] Music task created: ${taskId}`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`/ai/music-generation/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const musicUrl = result.generated?.[0]?.url;
  if (!musicUrl) throw new Error('No music URL in result');

  const filePath = await downloadFile(musicUrl, 'mp3');
  return filePath;
}

// ─────────────────────────────────────────
// TTS / VOICEOVER (ASYNC)
// ─────────────────────────────────────────

const VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  domi:   'AZnzlk1XvdvUeBnXmlld',
  bella:  'EXAVITQu4vr4xnSDxMaL',
};

/**
 * Generate text-to-speech voiceover.
 * @param {string} text
 * @param {string} voiceId - voice_id or name key (rachel|domi|bella)
 * @returns {string} local file path
 */
async function generateTTS(text, voiceId = 'rachel') {
  const resolvedVoiceId = VOICES[voiceId] || voiceId;

  const createRes = await freepikClient.post('/ai/voiceover', {
    text,
    voice_id: resolvedVoiceId,
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1.0,
  });

  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error('No task_id returned from voiceover');

  console.log(`[Freepik] TTS task created: ${taskId}`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`/ai/voiceover/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const audioUrl = result.generated?.[0]?.url;
  if (!audioUrl) throw new Error('No audio URL in voiceover result');

  const filePath = await downloadFile(audioUrl, 'mp3');
  return filePath;
}

module.exports = {
  generateImageClassic,
  generateImageMystic,
  generateVideo,
  generateMusic,
  generateTTS,
  VOICES,
  SIZE_MAP,
};
