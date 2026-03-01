'use strict';

const { Markup } = require('telegraf');

// ═══════════════════════════════════════════
//  ADMIN MAIN MENU
// ═══════════════════════════════════════════

function adminMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊  Statistik', 'admin:stats')],
    [Markup.button.callback('👥  User Management', 'admin:users')],
    [Markup.button.callback('💳  Credit & Plan', 'admin:credits')],
    [Markup.button.callback('📢  Broadcast', 'admin:broadcast')],
    [Markup.button.callback('🔑  API Keys', 'admin:apikeys')],
    [Markup.button.callback('📋  System Info', 'admin:system')],
    [Markup.button.callback('🔙  Kembali', 'back:main')],
  ]);
}

// ═══════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════

function userManagementKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔍  Cari User', 'admin:user_search')],
    [Markup.button.callback('👑  List Subscribers', 'admin:user_subs')],
    [Markup.button.callback('📋  List Semua User', 'admin:user_all')],
    [Markup.button.callback('🚫  List Banned', 'admin:user_banned')],
    [Markup.button.callback('📈  User Terbaru', 'admin:user_recent')],
    [Markup.button.callback('🔙  Admin Menu', 'admin:menu')],
  ]);
}

function userDetailKeyboard(telegramId, isBanned) {
  const banBtn = isBanned
    ? Markup.button.callback('✅ Unban', `admin:unban:${telegramId}`)
    : Markup.button.callback('🚫 Ban', `admin:ban:${telegramId}`);

  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 Set Plan', `admin:setplan:${telegramId}`),
     Markup.button.callback('➕ Add Credits', `admin:addcred:${telegramId}`)],
    [Markup.button.callback('🔄 Reset Credits', `admin:resetcred:${telegramId}`),
     banBtn],
    [Markup.button.callback('📊 User Jobs', `admin:userjobs:${telegramId}`)],
    [Markup.button.callback('🔙 User Menu', 'admin:users')],
  ]);
}

function planSelectionKeyboard(telegramId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🆓 Free', `admin:dosetplan:${telegramId}:free`)],
    [Markup.button.callback('🚀 Pro (30 hari)', `admin:dosetplan:${telegramId}:pro`)],
    [Markup.button.callback('♾️ Unlimited (30 hari)', `admin:dosetplan:${telegramId}:unlimited`)],
    [Markup.button.callback('🔙 Kembali', `admin:userdetail:${telegramId}`)],
  ]);
}

function creditTypeKeyboard(telegramId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎨 Image', `admin:credtype:${telegramId}:image`),
      Markup.button.callback('🎬 Video', `admin:credtype:${telegramId}:video`),
    ],
    [
      Markup.button.callback('🎵 Music', `admin:credtype:${telegramId}:music`),
      Markup.button.callback('🎧 SFX', `admin:credtype:${telegramId}:sfx`),
    ],
    [Markup.button.callback('🔊 TTS', `admin:credtype:${telegramId}:tts`)],
    [Markup.button.callback('🎁 Semua +50', `admin:credall:${telegramId}`)],
    [Markup.button.callback('🔙 Kembali', `admin:userdetail:${telegramId}`)],
  ]);
}

function userListPaginationKeyboard(page, totalPages, prefix) {
  const buttons = [];
  if (page > 0) {
    buttons.push(Markup.button.callback('⬅️ Prev', `${prefix}:${page - 1}`));
  }
  buttons.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'));
  if (page < totalPages - 1) {
    buttons.push(Markup.button.callback('➡️ Next', `${prefix}:${page + 1}`));
  }
  return Markup.inlineKeyboard([
    buttons,
    [Markup.button.callback('🔙 Admin Menu', 'admin:menu')],
  ]);
}

// ═══════════════════════════════════════════
//  CREDIT & PLAN MENU
// ═══════════════════════════════════════════

function creditPlanKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔍  Cari User & Set Plan', 'admin:cp_search')],
    [Markup.button.callback('👑  Bulk Pro (All Users)', 'admin:bulk_pro')],
    [Markup.button.callback('🎁  Bulk Add Credits', 'admin:bulk_credits')],
    [Markup.button.callback('📊  Revenue Report', 'admin:revenue')],
    [Markup.button.callback('🔙  Admin Menu', 'admin:menu')],
  ]);
}

// ═══════════════════════════════════════════
//  BROADCAST MENU
// ═══════════════════════════════════════════

function broadcastKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📢  Broadcast ke Semua', 'admin:bc_all')],
    [Markup.button.callback('👑  Broadcast ke Pro/Unlimited', 'admin:bc_subs')],
    [Markup.button.callback('🆓  Broadcast ke Free', 'admin:bc_free')],
    [Markup.button.callback('🔙  Admin Menu', 'admin:menu')],
  ]);
}

function broadcastConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Kirim', 'admin:bc_confirm'),
      Markup.button.callback('❌ Batal', 'admin:bc_cancel'),
    ],
  ]);
}

// ═══════════════════════════════════════════
//  API KEY MENU
// ═══════════════════════════════════════════

function apiKeyMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋  List API Keys', 'admin:ak_list')],
    [Markup.button.callback('➕  Tambah API Key', 'admin:ak_add')],
    [Markup.button.callback('📊  Rotation Stats', 'admin:ak_stats')],
    [Markup.button.callback('🔙  Admin Menu', 'admin:menu')],
  ]);
}

function apiKeyDetailKeyboard(keyId, isActive) {
  const toggleLabel = isActive ? '⏸ Disable' : '▶️ Enable';
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(toggleLabel, `admin:ak_toggle:${keyId}`),
      Markup.button.callback('🧪 Test', `admin:ak_test:${keyId}`),
    ],
    [Markup.button.callback('🗑 Hapus Permanen', `admin:ak_delete:${keyId}`)],
    [Markup.button.callback('🔙 API Keys', 'admin:apikeys')],
  ]);
}

// ═══════════════════════════════════════════
//  SYSTEM INFO
// ═══════════════════════════════════════════

function systemInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄  Refresh', 'admin:system')],
    [Markup.button.callback('🔙  Admin Menu', 'admin:menu')],
  ]);
}

module.exports = {
  adminMainKeyboard,
  userManagementKeyboard,
  userDetailKeyboard,
  planSelectionKeyboard,
  creditTypeKeyboard,
  userListPaginationKeyboard,
  creditPlanKeyboard,
  broadcastKeyboard,
  broadcastConfirmKeyboard,
  apiKeyMainKeyboard,
  apiKeyDetailKeyboard,
  systemInfoKeyboard,
};
