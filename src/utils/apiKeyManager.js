'use strict';

const ApiKey = require('../models/ApiKey');
const config = require('../config');

/**
 * API Key rotation manager.
 * Keys are stored in MongoDB and rotated round-robin style.
 * Falls back to FREEPIK_API_KEY env var if no keys are in DB.
 */

let keyIndex = 0;
let cachedKeys = [];
let cacheExpiry = 0;

const CACHE_TTL_MS = 30_000; // refresh key list every 30s

/**
 * Reload active keys from DB (cached for CACHE_TTL_MS).
 */
async function loadKeys() {
  const now = Date.now();
  if (cachedKeys.length > 0 && now < cacheExpiry) return cachedKeys;

  try {
    const keys = await ApiKey.find({ isActive: true }).sort({ createdAt: 1 }).lean();
    if (keys.length > 0) {
      cachedKeys = keys.map((k) => k.key);
      cacheExpiry = now + CACHE_TTL_MS;
    } else {
      // Fallback to env var
      cachedKeys = config.freepik.apiKey ? [config.freepik.apiKey] : [];
      cacheExpiry = now + CACHE_TTL_MS;
    }
  } catch (err) {
    console.error('[ApiKeyManager] Failed to load keys from DB:', err.message);
    if (cachedKeys.length === 0 && config.freepik.apiKey) {
      cachedKeys = [config.freepik.apiKey];
    }
  }
  return cachedKeys;
}

/**
 * Get the next API key using round-robin rotation.
 */
async function getNextKey() {
  const keys = await loadKeys();
  if (keys.length === 0) throw new Error('No Freepik API keys available');
  const key = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return key;
}

/**
 * Record a successful request for a key.
 */
async function recordSuccess(key) {
  try {
    await ApiKey.findOneAndUpdate(
      { key },
      { $inc: { requestCount: 1 }, $set: { lastUsedAt: new Date(), errorCount: 0 } }
    );
  } catch (_) {}
}

/**
 * Record a failed request for a key.
 * If errorCount exceeds threshold, deactivate the key.
 */
async function recordFailure(key) {
  try {
    const updated = await ApiKey.findOneAndUpdate(
      { key },
      { $inc: { requestCount: 1, errorCount: 1 }, $set: { lastUsedAt: new Date() } },
      { new: true }
    );
    // Auto-disable after 10 consecutive errors
    if (updated && updated.errorCount >= 10) {
      updated.isActive = false;
      await updated.save();
      invalidateCache();
      console.warn(`[ApiKeyManager] Key ${key.slice(0, 8)}... auto-disabled after ${updated.errorCount} consecutive errors`);
    }
  } catch (_) {}
}

/**
 * Force cache refresh (e.g., after adding/removing keys).
 */
function invalidateCache() {
  cachedKeys = [];
  cacheExpiry = 0;
  keyIndex = 0;
}

/**
 * Add a new API key.
 */
async function addKey(key, label, addedBy) {
  const existing = await ApiKey.findOne({ key });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.errorCount = 0;
      existing.label = label || existing.label;
      await existing.save();
      invalidateCache();
      return { reactivated: true, doc: existing };
    }
    return { duplicate: true, doc: existing };
  }

  const doc = await ApiKey.create({ key, label, addedBy, isActive: true });
  invalidateCache();
  return { created: true, doc };
}

/**
 * Remove (deactivate) a key.
 */
async function removeKey(keyId) {
  const doc = await ApiKey.findByIdAndUpdate(keyId, { isActive: false }, { new: true });
  invalidateCache();
  return doc;
}

/**
 * Permanently delete a key.
 */
async function deleteKey(keyId) {
  const doc = await ApiKey.findByIdAndDelete(keyId);
  invalidateCache();
  return doc;
}

/**
 * List all keys (active and inactive).
 */
async function listKeys() {
  return ApiKey.find().sort({ createdAt: 1 });
}

/**
 * Toggle a key's active status.
 */
async function toggleKey(keyId) {
  const doc = await ApiKey.findById(keyId);
  if (!doc) return null;
  doc.isActive = !doc.isActive;
  doc.errorCount = 0;
  await doc.save();
  invalidateCache();
  return doc;
}

/**
 * Test a key by making a lightweight request.
 */
async function testKey(key) {
  const axios = require('axios');
  try {
    const res = await axios.get(`${config.freepik.baseUrl}/ai/text-to-image`, {
      headers: { 'x-freepik-api-key': key },
      timeout: 10000,
      validateStatus: () => true, // Don't throw on error status
    });
    return { status: res.status, ok: res.status >= 200 && res.status < 500 };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

/**
 * Get rotation stats.
 */
async function getStats() {
  const [total, active, inactive] = await Promise.all([
    ApiKey.countDocuments(),
    ApiKey.countDocuments({ isActive: true }),
    ApiKey.countDocuments({ isActive: false }),
  ]);
  const totalRequests = await ApiKey.aggregate([
    { $group: { _id: null, total: { $sum: '$requestCount' } } },
  ]);
  return {
    total,
    active,
    inactive,
    totalRequests: totalRequests[0]?.total || 0,
    currentIndex: keyIndex,
  };
}

module.exports = {
  getNextKey,
  recordSuccess,
  recordFailure,
  invalidateCache,
  addKey,
  removeKey,
  deleteKey,
  listKeys,
  toggleKey,
  testKey,
  getStats,
};
