'use strict';

/**
 * Redis-backed session store compatible with Telegraf v4 session() middleware.
 * Interface: { get(key): Promise<object>, set(key, value): Promise<void> }
 */
class RedisSessionStore {
  /**
   * @param {import('ioredis').Redis} client - IORedis client instance
   * @param {object} options
   * @param {string} options.prefix - key prefix (default 'tgbot:sess:')
   * @param {number} options.ttl - TTL in seconds (default 86400 = 24h)
   */
  constructor(client, options = {}) {
    this.client = client;
    this.prefix = options.prefix || 'tgbot:sess:';
    this.ttl = options.ttl || 86400; // 24 hours
  }

  _key(sessionKey) {
    return `${this.prefix}${sessionKey}`;
  }

  async get(sessionKey) {
    const raw = await this.client.get(this._key(sessionKey));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  async set(sessionKey, session) {
    const serialized = JSON.stringify(session);
    await this.client.setex(this._key(sessionKey), this.ttl, serialized);
  }

  async delete(sessionKey) {
    await this.client.del(this._key(sessionKey));
  }
}

module.exports = { RedisSessionStore };
