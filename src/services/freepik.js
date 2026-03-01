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
  timeout: 120000,
});

// Interceptor: log detailed Freepik API errors
freepikClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      const { status, data } = err.response;
      const detail = typeof data === 'object' ? JSON.stringify(data) : data;
      console.error(`[Freepik] API ${status}: ${detail}`);
      const msg = data?.message || data?.error?.message || data?.detail || `Request failed with status code ${status}`;
      throw new Error(msg);
    }
    throw err;
  }
);

// ─────────────────────────────────────────
// POLLING HELPER
// ─────────────────────────────────────────

async function pollUntilDone(checkFn, taskId) {
  const { maxAttempts, intervalMs } = config.polling;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const data = await checkFn();
    const status = (data.status || '').toUpperCase();
    console.log(`[Freepik] Poll ${taskId} attempt ${attempt}/${maxAttempts}: ${status}`);
    if (status === 'DONE' || status === 'COMPLETED') return data;
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`Task ${taskId} failed: ${status}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Helper: generic async image generator
async function generateAsyncImage(endpoint, body, pollEndpoint) {
  const createRes = await freepikClient.post(endpoint, body);
  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error(`No task_id from ${endpoint}`);
  console.log(`[Freepik] Image task ${taskId} (${endpoint})`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`${pollEndpoint}/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const imageUrl = result.generated?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL from ${endpoint}`);
  return downloadFile(imageUrl, 'jpg');
}

// Helper: generic async video generator
async function generateAsyncVideo(endpoint, body, pollEndpoint) {
  const createRes = await freepikClient.post(endpoint, body);
  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error(`No task_id from ${endpoint}`);
  console.log(`[Freepik] Video task ${taskId} (${endpoint})`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`${pollEndpoint}/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const videoUrl = result.generated?.[0]?.url;
  if (!videoUrl) throw new Error(`No video URL from ${endpoint}`);
  return downloadFile(videoUrl, 'mp4');
}

// Helper: generic async audio generator
async function generateAsyncAudio(endpoint, body, pollEndpoint, ext = 'mp3') {
  const createRes = await freepikClient.post(endpoint, body);
  const taskId = createRes.data?.data?.task_id;
  if (!taskId) throw new Error(`No task_id from ${endpoint}`);
  console.log(`[Freepik] Audio task ${taskId} (${endpoint})`);

  const result = await pollUntilDone(async () => {
    const res = await freepikClient.get(`${pollEndpoint}/${taskId}`);
    return res.data?.data || res.data;
  }, taskId);

  const audioUrl = result.generated?.[0]?.url;
  if (!audioUrl) throw new Error(`No audio URL from ${endpoint}`);
  return downloadFile(audioUrl, ext);
}

// ═════════════════════════════════════════
//  SIZE MAPS
// ═════════════════════════════════════════

const SIZE_MAP = {
  square_1_1:     'square_1_1',
  portrait_3_4:   'portrait_3_4',
  landscape_4_3:  'landscape_4_3',
  portrait_9_16:  'portrait_9_16',
  landscape_16_9: 'landscape_16_9',
};

// ═════════════════════════════════════════
//  IMAGE — All Models
// ═════════════════════════════════════════

// Classic Fast (synchronous, returns base64)
async function generateImageClassic(prompt, size = 'square_1_1') {
  const body = {
    prompt,
    negative_prompt: 'blur, distort, low quality, ugly, watermark',
    guidance_scale: 2,
    num_images: 1,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  };
  console.log('[Freepik] Classic Fast request');
  const response = await freepikClient.post('/ai/text-to-image', body);
  const imageData = response.data?.data?.[0];
  if (!imageData) throw new Error('No image data from Classic Fast');
  if (imageData.has_nsfw) throw new Error('NSFW content detected');
  const buffer = Buffer.from(imageData.base64, 'base64');
  return saveBufferToFile(buffer, 'jpg');
}

// Mystic 2K (async)
async function generateImageMystic(prompt) {
  return generateAsyncImage('/ai/mystic', {
    prompt,
    negative_prompt: 'blur, distort, low quality, ugly, watermark',
    resolution: '2k',
    detail_level: 0.5,
  }, '/ai/mystic');
}

// Flux Dev (async)
async function generateImageFluxDev(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/flux-dev', {
    prompt,
    guidance_scale: 3.5,
    num_images: 1,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/flux-dev');
}

// Flux 2 Pro (async)
async function generateImageFlux2Pro(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/flux-2-pro', {
    prompt,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/flux-2-pro');
}

// Flux 2 Klein (async, fast)
async function generateImageFlux2Klein(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/flux-2-klein', {
    prompt,
    aspect_ratio: SIZE_MAP[size] || 'square_1_1',
  }, '/ai/text-to-image/flux-2-klein');
}

// Flux Kontext Pro (async)
async function generateImageFluxKontextPro(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/flux-kontext-pro', {
    prompt,
    aspect_ratio: SIZE_MAP[size] || 'square_1_1',
  }, '/ai/text-to-image/flux-kontext-pro');
}

// HyperFlux (async)
async function generateImageHyperFlux(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/hyperflux', {
    prompt,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/hyperflux');
}

// Seedream v4.5 (async)
async function generateImageSeedream(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/seedream-v4-5', {
    prompt,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/seedream-v4-5');
}

// Seedream v5 Lite (async)
async function generateImageSeedreamV5(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/seedream-v5-lite', {
    prompt,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/seedream-v5-lite');
}

// Z-Image (async, turbo)
async function generateImageZImage(prompt, size = 'square_1_1') {
  return generateAsyncImage('/ai/text-to-image/z-image', {
    prompt,
    image: { size: SIZE_MAP[size] || 'square_1_1' },
  }, '/ai/text-to-image/z-image');
}

// ═════════════════════════════════════════
//  VIDEO — All Models
// ═════════════════════════════════════════

// Kling v3 Pro / Std
async function generateVideo(prompt, options = {}) {
  const model = options.model === 'std' ? 'kling-v3' : 'kling-v3-pro';
  return generateAsyncVideo(`/ai/video/${model}`, {
    prompt,
    aspect_ratio: options.aspectRatio || '16:9',
    duration: String(options.duration || '5'),
    generate_audio: true,
    negative_prompt: 'blur, distort, low quality',
  }, '/ai/video/kling-v3');
}

// Kling v3 Omni Pro / Std
async function generateVideoKlingOmni(prompt, options = {}) {
  const quality = options.model === 'omni_std' ? 'kling-v3-omni-std' : 'kling-v3-omni-pro';
  return generateAsyncVideo(`/ai/video/${quality}`, {
    prompt,
    aspect_ratio: options.aspectRatio || '16:9',
    duration: parseInt(options.duration || '5', 10),
    generate_audio: true,
  }, '/ai/video/kling-v3-omni');
}

// Runway Gen 4.5 T2V
async function generateVideoRunway(prompt, options = {}) {
  const RUNWAY_RATIOS = { '16:9': '1280:720', '9:16': '720:1280', '1:1': '960:960', '4:3': '1104:832', '3:4': '832:1104' };
  return generateAsyncVideo('/ai/text-to-video/runway-4-5', {
    prompt,
    ratio: RUNWAY_RATIOS[options.aspectRatio] || '1280:720',
    duration: parseInt(options.duration || '5', 10),
  }, '/ai/text-to-video/runway-4-5');
}

// Wan 2.5 T2V 720p
async function generateVideoWan(prompt, options = {}) {
  return generateAsyncVideo('/ai/text-to-video/wan-2-5-t2v-720p', {
    prompt,
  }, '/ai/text-to-video/wan-2-5-t2v-720p');
}

// Seedance 1.5 Pro 720p
async function generateVideoSeedance(prompt, options = {}) {
  return generateAsyncVideo('/ai/video/seedance-1-5-pro-720p', {
    prompt,
  }, '/ai/video/seedance-1-5-pro-720p');
}

// ═════════════════════════════════════════
//  MUSIC
// ═════════════════════════════════════════

async function generateMusic(prompt, durationSeconds = 30) {
  const allowed = [15, 30, 60];
  const length = allowed.includes(durationSeconds) ? durationSeconds : 30;
  return generateAsyncAudio('/ai/music-generation', {
    prompt,
    music_length_seconds: length,
  }, '/ai/music-generation');
}

// ═════════════════════════════════════════
//  SOUND EFFECTS (NEW)
// ═════════════════════════════════════════

async function generateSFX(prompt, durationSeconds = 5) {
  return generateAsyncAudio('/ai/sound-effects', {
    prompt,
    duration_seconds: durationSeconds,
  }, '/ai/sound-effects');
}

// ═════════════════════════════════════════
//  TTS / VOICEOVER
// ═════════════════════════════════════════

const VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  domi:   'AZnzlk1XvdvUeBnXmlld',
  bella:  'EXAVITQu4vr4xnSDxMaL',
};

async function generateTTS(text, voiceId = 'rachel') {
  const resolvedVoiceId = VOICES[voiceId] || voiceId;
  return generateAsyncAudio('/ai/voiceover', {
    text,
    voice_id: resolvedVoiceId,
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1.0,
  }, '/ai/voiceover');
}

module.exports = {
  generateImageClassic,
  generateImageMystic,
  generateImageFluxDev,
  generateImageFlux2Pro,
  generateImageFlux2Klein,
  generateImageFluxKontextPro,
  generateImageHyperFlux,
  generateImageSeedream,
  generateImageSeedreamV5,
  generateImageZImage,
  generateVideo,
  generateVideoKlingOmni,
  generateVideoRunway,
  generateVideoWan,
  generateVideoSeedance,
  generateMusic,
  generateSFX,
  generateTTS,
  VOICES,
  SIZE_MAP,
};
