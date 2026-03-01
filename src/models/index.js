'use strict';

const mongoose = require('mongoose');
const config = require('../config');

async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected');
});

module.exports = {
  connectDB,
  User: require('./User'),
  Job: require('./Job'),
  Transaction: require('./Transaction'),
  ApiKey: require('./ApiKey'),
};
