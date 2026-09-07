export function getAllowedOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS ??
    process.env.FRONTEND_URL ??
    'http://localhost:5000,http://localhost:8081'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|(?:192\.168|10|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+):(5000|8081)$/;

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles one allow-list entry, where `*` stands for any run of characters
 * within a single hostname label — so `https://web-*.vercel.app` matches
 * every per-deployment preview URL but not `https://web-x.evil.com`.
 */
function toPattern(entry: string): RegExp {
  return new RegExp(
    `^${entry.split('*').map(escapeRegExp).join('[^./]*')}$`,
    'i',
  );
}

let cache: { raw: string; patterns: RegExp[] } | undefined;

function wildcardPatterns(origins: string[]): RegExp[] {
  const raw = origins.join(',');
  if (cache?.raw !== raw) {
    cache = {
      raw,
      patterns: origins.filter((o) => o.includes('*')).map(toPattern),
    };
  }
  return cache.patterns;
}

/** True when `origin` is an explicitly allow-listed or dev-pattern origin. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const origins = getAllowedOrigins();
  return (
    origins.includes(origin) ||
    DEV_ORIGIN_PATTERN.test(origin) ||
    wildcardPatterns(origins).some((p) => p.test(origin))
  );
}
