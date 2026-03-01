'use strict';

const { sfxDurationKeyboard, sfxConfirmKeyboard } = require('../menus/sfxMenu');
const { sendMainMenu } = require('../menus/mainMenu');
const { submitJob } = require('./jobHandler');

async function startSfxFlow(ctx) {
  ctx.session.type = 'sfx';
  ctx.session.step = 'select_duration';
  ctx.session.selectedDuration = null;
  ctx.session.prompt = null;

  await ctx.reply(
    '🔊 *Generate Sound Effects AI*\n\nPilih durasi efek suara:',
    { parse_mode: 'Markdown', ...sfxDurationKeyboard() }
  );
}

async function handleSfxDuration(ctx, duration) {
  ctx.session.selectedDuration = duration;
  ctx.session.step = 'awaiting_prompt';

  await ctx.editMessageText(
    `🔊 *Generate Sound Effects AI*\nDurasi: *${duration} detik*\n\n` +
    `✏️ Deskripsikan efek suara yang ingin kamu buat:\n\n` +
    `_Contoh: "Thunder cracking in a storm, rain pouring on metal roof"_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSfxPrompt(ctx) {
  const prompt = ctx.message.text;

  const duration = ctx.session.selectedDuration;
  if (!duration) {
    ctx.session.step = 'main_menu';
    await ctx.reply('❌ Sesi kamu kadaluarsa. Silakan mulai ulang dari menu.');
    return sendMainMenu(ctx);
  }

  ctx.session.prompt = prompt;
  ctx.session.step = 'confirming';

  await ctx.reply(
    `🔊 *Konfirmasi Generate Sound Effects*\n\n` +
    `⏱ Durasi: *${duration} detik*\n` +
    `📝 Prompt:\n\`${prompt}\`\n\n` +
    `Lanjutkan generate?`,
    { parse_mode: 'Markdown', ...sfxConfirmKeyboard() }
  );
}

async function confirmSfxGeneration(ctx) {
  const { selectedDuration, prompt } = ctx.session;

  if (!selectedDuration || !prompt) {
    ctx.session.step = 'main_menu';
    await ctx.editMessageText('❌ Sesi kadaluarsa. Silakan mulai ulang.').catch(() => {});
    return sendMainMenu(ctx);
  }

  ctx.session.step = 'generating';

  await ctx.editMessageText(
    `⏳ *Sedang memproses...*\n\nJob sound effects kamu sudah masuk antrian.`,
    { parse_mode: 'Markdown' }
  );

  const options = { duration: selectedDuration };
  const jobId = await submitJob(ctx, 'sfx', prompt, 'sfx_gen', options);

  if (jobId) {
    ctx.session.pendingJobId = jobId;
    ctx.session.step = 'main_menu';
    await ctx.reply(
      `✅ *Job SFX #${jobId.slice(0, 8)} berhasil ditambahkan!*\n\nHasil akan dikirim otomatis setelah selesai.`,
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = { startSfxFlow, handleSfxDuration, handleSfxPrompt, confirmSfxGeneration };
