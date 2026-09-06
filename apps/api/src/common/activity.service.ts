import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * How stale `lastActiveAt` is allowed to get before another write. The admin
 * list renders it as a date, so minutes of drift are invisible — and without a
 * throttle every poll from every open app would be a row update.
 */
const TOUCH_INTERVAL_MS = 5 * 60_000;

/**
 * Ceiling on the throttle map so a traffic spike can't grow it without bound.
 * Well above any plausible concurrent-user count; hitting it just means some
 * users write a little more often than they strictly need to.
 */
const MAX_TRACKED_USERS = 10_000;

/** Semver-ish, plus the build suffixes stores allow. Bounded to keep a hostile client from writing an essay into the column. */
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,32}$/;

const KNOWN_PLATFORMS = new Set(['android', 'ios', 'web']);

type LastSeen = {
  at: number;
  version: string | null;
  platform: string | null;
};

/**
 * Records "this account was here just now", and which client it was using.
 *
 * The throttle lives in process memory rather than Redis on purpose: this sits
 * on the hot path of every authenticated request, and an in-memory Map costs
 * nothing and keeps working when Redis doesn't. The cost is that a restart, or
 * a second instance, allows one redundant write per user per window — which is
 * a rounding error against the writes it prevents.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly lastSeen = new Map<string, LastSeen>();
  private lastWarnAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget: never awaited by the request it came from, and never
   * allowed to fail it. A dropped touch costs at most a few minutes of
   * precision on a stat.
   */
  touch(
    userId: string,
    rawVersion: string | undefined,
    rawPlatform: string | undefined,
  ): void {
    const version = normalizeVersion(rawVersion);
    const platform = normalizePlatform(rawPlatform);

    const previous = this.lastSeen.get(userId);
    // Write early when the client changed underneath us — a version bump is
    // the whole point of the column, and waiting out the window would report
    // the old build as current.
    const withinWindow =
      previous !== undefined &&
      Date.now() - previous.at < TOUCH_INTERVAL_MS &&
      previous.version === version &&
      previous.platform === platform;
    if (withinWindow) return;

    this.remember(userId, { at: Date.now(), version, platform });
    void this.write(userId, platform, version);
  }

  private remember(userId: string, seen: LastSeen) {
    if (this.lastSeen.size >= MAX_TRACKED_USERS && !this.lastSeen.has(userId)) {
      this.prune();
    }
    this.lastSeen.set(userId, seen);
  }

  /** Drop entries whose window has already lapsed; they'd write on sight anyway. */
  private prune() {
    const cutoff = Date.now() - TOUCH_INTERVAL_MS;
    for (const [id, seen] of this.lastSeen) {
      if (seen.at < cutoff) this.lastSeen.delete(id);
    }
    // Still full — every entry is live. Start over rather than grow: the only
    // consequence is a burst of writes that the next window re-throttles.
    if (this.lastSeen.size >= MAX_TRACKED_USERS) this.lastSeen.clear();
  }

  private async write(
    userId: string,
    platform: string | null,
    version: string | null,
  ) {
    try {
      // updateMany, not update: an account deleted mid-request matches nothing
      // and is a no-op, where update would throw P2025.
      await this.prisma.user.updateMany({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
          // Only rewrite the client fields when the request actually named a
          // platform. A build predating these headers then updates its
          // last-active without blanking what we already knew about it, while
          // a client that does identify itself overwrites both together — so
          // a web session correctly clears a stale mobile version rather than
          // leaving "2.0.0" hanging off a platform of "web".
          ...(platform
            ? { lastAppPlatform: platform, lastAppVersion: version }
            : {}),
        },
      });
    } catch (err) {
      // Let the next request retry: drop the throttle entry so it isn't
      // suppressed for the rest of the window.
      this.lastSeen.delete(userId);
      this.warnThrottled(err);
    }
  }

  // A database blip would otherwise log once per request per user.
  private warnThrottled(err: unknown) {
    const now = Date.now();
    if (now - this.lastWarnAt < 30_000) return;
    this.lastWarnAt = now;
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`activity touch failed: ${message}`);
  }
}

function normalizeVersion(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || !VERSION_PATTERN.test(value)) return null;
  return value;
}

function normalizePlatform(raw: string | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value || !KNOWN_PLATFORMS.has(value)) return null;
  return value;
}
