import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const TOUCH_INTERVAL_MS = 5 * 60_000;

const MAX_TRACKED_USERS = 10_000;

/** Semver-ish, plus the build suffixes stores allow. Bounded to keep a hostile client from writing an essay into the column. */
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,32}$/;

const KNOWN_PLATFORMS = new Set(['android', 'ios', 'web']);

type LastSeen = {
  at: number;
  version: string | null;
  platform: string | null;
};

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly lastSeen = new Map<string, LastSeen>();
  private lastWarnAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  touch(
    userId: string,
    rawVersion: string | undefined,
    rawPlatform: string | undefined,
  ): void {
    const version = normalizeVersion(rawVersion);
    const platform = normalizePlatform(rawPlatform);

    const previous = this.lastSeen.get(userId);

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

    if (this.lastSeen.size >= MAX_TRACKED_USERS) this.lastSeen.clear();
  }

  private async write(
    userId: string,
    platform: string | null,
    version: string | null,
  ) {
    try {
      await this.prisma.user.updateMany({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
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
