'use strict';

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId:       { type: String, required: true, unique: true, index: true },
  userId:      { type: Number, required: true, index: true },
  chatId:      { type: Number, required: true },
  messageId:   { type: Number, default: null },
  type:        { type: String, enum: ['image', 'video', 'music', 'tts'], required: true },
  model:       { type: String, required: true },
  prompt:      { type: String, required: true },
  options:     { type: mongoose.Schema.Types.Mixed, default: {} },
  status:      { type: String, enum: ['queued', 'processing', 'done', 'failed'], default: 'queued', index: true },
  resultUrl:   { type: String, default: null },
  resultPath:  { type: String, default: null },
  errorMsg:    { type: String, default: null },
  priority:    { type: Number, default: 0 },
  attempts:    { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
