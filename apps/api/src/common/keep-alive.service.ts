import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

const TEN_MINUTES_MS = 10 * 60 * 1000;
// setInterval clamps delays above 2^31-1 ms down to 1ms — reject them.
const MAX_INTERVAL_MS = 2147483647;
const RETRY_DELAY_MS = 60 * 1000;

// Render's free tier spins a service down after 15 minutes without inbound
// traffic. Pinging our own public URL every 10 minutes counts as traffic and
// keeps the instance awake. RENDER_EXTERNAL_URL is set automatically by
// Render; KEEP_ALIVE_URL is a manual override for other hosts. When neither
// is set (local dev, tests) the service does nothing.
@Injectable()
export class KeepAliveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeepAliveService.name);
  private timer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;

  onModuleInit() {
    // || not ??: an empty-string KEEP_ALIVE_URL (e.g. bulk-imported from
    // .env.example) must fall through to RENDER_EXTERNAL_URL, not disable us.
    const baseUrl = (
      process.env.KEEP_ALIVE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      ''
    ).trim();
    if (!baseUrl) return;

    const url = `${baseUrl.replace(/\/$/, '')}/health`;
    // Guard against '' / garbage in KEEP_ALIVE_INTERVAL_MS — Number('') is 0
    // and setInterval(fn, 0) would ping in a tight loop.
    const parsed = Number(process.env.KEEP_ALIVE_INTERVAL_MS);
    const intervalMs =
      Number.isFinite(parsed) && parsed >= 1000 && parsed <= MAX_INTERVAL_MS
        ? parsed
        : TEN_MINUTES_MS;

    this.timer = setInterval(() => void this.ping(url), intervalMs);
    // Never block process shutdown on the keep-alive timers.
    this.timer.unref();
    this.logger.log(
      `Keep-alive enabled: pinging ${url} every ${Math.round(intervalMs / 1000)}s`,
    );
    // Ping right away so the idle clock resets from boot, not first interval.
    void this.ping(url);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private async ping(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // Reached Render's proxy, so the idle clock still reset — no retry.
        this.logger.warn(`Keep-alive ping returned ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `Keep-alive ping failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // A ping that never reached the proxy didn't reset the 15-min idle
      // clock, and the next interval tick may land too late — retry soon.
      this.scheduleRetry(url);
    }
  }

  private scheduleRetry(url: string) {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.ping(url);
    }, RETRY_DELAY_MS);
    this.retryTimer.unref();
  }
}
