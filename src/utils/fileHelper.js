'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

async function ensureDirs() {
  await fsp.mkdir(config.paths.uploads, { recursive: true });
  await fsp.mkdir(config.paths.temp, { recursive: true });
}

/**
 * Save a base64 string as a file.
 * @param {string} base64 
 * @param {string} ext - e.g. 'jpg', 'mp3', 'mp4'
 * @returns {string} absolute file path
 */
async function saveBase64ToFile(base64, ext = 'jpg') {
  await ensureDirs();
  const filename = `${uuidv4()}.${ext}`;
  const filePath = path.resolve(config.paths.uploads, filename);
  const buffer = Buffer.from(base64, 'base64');
  await fsp.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Save a Buffer directly as a file.
 * @param {Buffer} buffer 
 * @param {string} ext 
 * @returns {string} absolute file path
 */
async function saveBufferToFile(buffer, ext = 'jpg') {
  await ensureDirs();
  const filename = `${uuidv4()}.${ext}`;
  const filePath = path.resolve(config.paths.uploads, filename);
  await fsp.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Download a URL to a local file.
 * @param {string} url 
 * @param {string} ext 
 * @returns {string} absolute file path
 */
async function downloadFile(url, ext = 'jpg') {
  await ensureDirs();
  const filename = `${uuidv4()}.${ext}`;
  const filePath = path.resolve(config.paths.uploads, filename);

  const response = await axios.get(url, { responseType: 'stream', timeout: 120000 });
  const writer = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return filePath;
}

/**
 * Delete a file silently.
 */
async function deleteFile(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (_) {
    // ignore
  }
}

module.exports = {
  ensureDirs,
  saveBase64ToFile,
  saveBufferToFile,
  downloadFile,
  deleteFile,
};
