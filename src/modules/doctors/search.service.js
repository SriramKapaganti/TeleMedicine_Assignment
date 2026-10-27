'use strict';

const crypto = require('crypto');
const { cacheService } = require('../../utils/cache');
const logger = require('../../config/logger');

class DoctorSearchService {
  constructor(doctorsRepo) {
    this.doctorsRepo = doctorsRepo;
    this.TTL_SECONDS = 60; // 60s Redis caching for search queries
  }

  generateCacheKey(query) {
    const serialized = JSON.stringify(query);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    return `doctors:search:${hash}`;
  }

  async searchDoctors(query) {
    const cacheKey = this.generateCacheKey(query);

    // 1. Check Redis cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, '[CACHE_HIT] Doctor search returned from Redis');
      return { ...cached, fromCache: true };
    }

    // 2. Query Database
    const limit = query.limit || 10;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    const results = await this.doctorsRepo.search({
      ...query,
      limit,
      offset,
    });

    const responsePayload = {
      data: results,
      meta: {
        page,
        limit,
        count: results.length,
      },
    };

    // 3. Populate Redis cache
    await cacheService.set(cacheKey, responsePayload, this.TTL_SECONDS);

    return { ...responsePayload, fromCache: false };
  }
}

module.exports = DoctorSearchService;
