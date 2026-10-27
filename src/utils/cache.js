'use strict';

/**
 * Cache utility wrapping Redis operations with safe fallbacks.
 */
class CacheService {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.memoryFallback = new Map();
  }

  setClient(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    try {
      if (this.redis && this.redis.status === 'ready') {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      }
      const item = this.memoryFallback.get(key);
      if (item) {
        if (item.expiresAt && Date.now() > item.expiresAt) {
          this.memoryFallback.delete(key);
          return null;
        }
        return item.value;
      }
      return null;
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds = 60) {
    try {
      const serialized = JSON.stringify(value);
      if (this.redis && this.redis.status === 'ready') {
        if (ttlSeconds > 0) {
          await this.redis.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redis.set(key, serialized);
        }
        return true;
      }
      this.memoryFallback.set(key, {
        value,
        expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
      });
      return true;
    } catch {
      return false;
    }
  }

  async del(key) {
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.del(key);
      }
      this.memoryFallback.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  async invalidatePrefix(prefix) {
    try {
      if (this.redis && this.redis.status === 'ready') {
        const stream = this.redis.scanStream({
          match: `${prefix}*`,
          count: 100,
        });
        const keysToDelete = [];
        for await (const keys of stream) {
          if (keys.length > 0) {
            keysToDelete.push(...keys);
          }
        }
        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete);
        }
      }
      for (const key of this.memoryFallback.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryFallback.delete(key);
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { CacheService, cacheService: new CacheService() };
