import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service.js';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const client = this.redis.getClient();
    if (!client) return null;
    try {
      const raw = await client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err) {
      this.warnOnce('get', err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.warnOnce('set', err);
    }
  }

  async del(...keys: string[]): Promise<void> {
    const client = this.redis.getClient();
    if (!client || keys.length === 0) return;
    try {
      await client.del(...keys);
    } catch (err) {
      this.warnOnce('del', err);
    }
  }

  /**
   * Read-through cache: return the cached value, or run the loader and cache
   * its result. null/undefined loader results are returned but not cached,
   * so "not found" is never pinned (a deleted user's token keeps failing at
   * the DB, exactly as it did uncached).
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await loader();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  /**
   * Like getOrSet, but the key lives under a version namespace:
   * `{ns}:v{version}:{subkey}`. bumpVersion(ns) orphans every key under the
   * namespace in one O(1) write; orphans expire via their TTL. When Redis
   * can't supply a version, the cache is skipped entirely rather than
   * guessing.
   */
  async getOrSetVersioned<T>(
    namespace: string,
    subkey: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const version = await this.version(namespace);
    if (version === null) return loader();
    return this.getOrSet(
      `${namespace}:v${version}:${subkey}`,
      ttlSeconds,
      loader,
    );
  }

  /** Invalidate everything cached under a versioned namespace. */
  async bumpVersion(namespace: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    try {
      await client.incr(`${namespace}:ver`);
    } catch (err) {
      this.warnOnce('bumpVersion', err);
    }
  }

  /**
   * Current version of a namespace, or null when Redis is unavailable.
   * Initialized to the current epoch-millis (not 0) so that if the version
   * key is ever evicted while data keys still live, the fresh version can't
   * collide with one already used — INCR continues from the timestamp.
   */
  private async version(namespace: string): Promise<string | null> {
    const client = this.redis.getClient();
    if (!client) return null;
    const key = `${namespace}:ver`;
    try {
      let version = await client.get(key);
      if (version === null) {
        await client.setnx(key, Date.now());
        version = await client.get(key); // re-read: SETNX may have lost the race
      }
      return version;
    } catch (err) {
      this.warnOnce('version', err);
      return null;
    }
  }

  // A Redis outage makes every request warn on every cache call; RedisService
  // already logs connection state, so per-command noise is throttled hard.
  private lastWarnAt = 0;
  private warnOnce(op: string, err: unknown) {
    const now = Date.now();
    if (now - this.lastWarnAt < 30_000) return;
    this.lastWarnAt = now;
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`cache ${op} failed: ${message}`);
  }
}
