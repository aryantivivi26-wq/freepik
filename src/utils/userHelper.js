'use strict';

const { User } = require('../models');
const config = require('../config');

/**
 * Get or create a user from Telegram context.
 */
async function getOrCreateUser(ctx) {
  const tgUser = ctx.from;
  let user = await User.findOne({ telegramId: tgUser.id });

  if (!user) {
    user = await User.create({
      telegramId: tgUser.id,
      username: tgUser.username || null,
      firstName: tgUser.first_name || null,
      lastName: tgUser.last_name || null,
      plan: 'free',
      credits: { ...config.plans.free.credits },
    });
    console.log(`[User] New user created: ${tgUser.id}`);
  } else {
    // Only save if profile info actually changed
    const newUsername = tgUser.username || null;
    const newFirstName = tgUser.first_name || null;
    const newLastName = tgUser.last_name || null;

    if (
      user.username !== newUsername ||
      user.firstName !== newFirstName ||
      user.lastName !== newLastName
    ) {
      user.username = newUsername;
      user.firstName = newFirstName;
      user.lastName = newLastName;
      await user.save();
    }
  }

  return user;
}

/**
 * Upgrade user plan after successful payment.
 */
async function upgradeUserPlan(userId, plan) {
  const planConfig = config.plans[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  const user = await User.findOne({ telegramId: userId });
  if (!user) throw new Error(`User not found: ${userId}`);

  user.plan = plan;
  user.credits = { ...planConfig.credits };

  if (planConfig.durationDays) {
    const now = new Date();
    now.setDate(now.getDate() + planConfig.durationDays);
    user.planExpiresAt = now;
  }

  await user.save();
  return user;
}

/**
 * Format user profile string.
 */
function formatUserProfile(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
  const planExpiry = user.planExpiresAt
    ? `\n📅 Expires: ${new Date(user.planExpiresAt).toLocaleDateString('id-ID')}`
    : '';

  return (
    `👤 *Profile*\n` +
    `Name: ${name}\n` +
    `Username: ${user.username ? '@' + user.username : '-'}\n` +
    `ID: \`${user.telegramId}\`\n` +
    `Plan: *${user.plan.toUpperCase()}*${planExpiry}\n\n` +
    `*Credits:*\n` +
    `🖼 Image: ${user.credits.image}\n` +
    `🎬 Video: ${user.credits.video}\n` +
    `🎵 Music: ${user.credits.music}\n` +
    `🔊 SFX: ${user.credits.sfx || 0}\n` +
    `🗣 TTS: ${user.credits.tts}`
  );
}

module.exports = {
  getOrCreateUser,
  upgradeUserPlan,
  formatUserProfile,
};
