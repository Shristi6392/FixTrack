const Redis = require('ioredis');

// Fixed-window counter. Redis when REDIS_URL is set (shared across instances), in-memory otherwise.
class MemoryStore {
  constructor() { this.hits = new Map(); }
  async incr(key, windowSec) {
    const now = Date.now();
    const e = this.hits.get(key);
    if (!e || e.reset <= now) { this.hits.set(key, { n: 1, reset: now + windowSec * 1000 }); return { count: 1, ttl: windowSec }; }
    e.n += 1;
    return { count: e.n, ttl: Math.ceil((e.reset - now) / 1000) };
  }
}

class RedisStore {
  constructor(client) { this.client = client; }
  async incr(key, windowSec) {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSec);
    const ttl = await this.client.ttl(key);
    return { count, ttl: ttl > 0 ? ttl : windowSec };
  }
}

function createStore() {
  if (!process.env.REDIS_URL) return new MemoryStore();
  const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  client.on('error', () => {}); // fail open below; don't crash on connection errors
  return new RedisStore(client);
}

// rateLimit({ windowSec, max, name }) -> express middleware keyed by client IP.
// If the store errors (e.g. Redis down) requests are allowed through: availability beats strictness.
function rateLimit({ windowSec = 60, max = 20, name = 'rl', store = createStore() } = {}) {
  return async (req, res, next) => {
    try {
      const { count, ttl } = await store.incr(`${name}:${req.ip}`, windowSec);
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (count > max) { res.set('Retry-After', String(ttl)); return res.status(429).json({ error: 'Too many requests, please try again later' }); }
    } catch { /* fail open */ }
    next();
  };
}

module.exports = { rateLimit, MemoryStore, RedisStore };
