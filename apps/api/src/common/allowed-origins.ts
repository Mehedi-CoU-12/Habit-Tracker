// Single source of truth for which browser origins may talk to the API.
// Used by both the CORS config (main.ts) and the ClientGuard so the two can
// never drift apart.

// Explicit allow-list (comma-separated CORS_ORIGINS or FRONTEND_URL) plus
// sensible dev defaults: the Next.js web app (3000) and the Expo web dev
// server (8081).
export function getAllowedOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000,http://localhost:8081'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Loopback/LAN origins on the common dev ports — lets the web app and the
// Expo web build connect from localhost or your machine's LAN IP.
const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|(?:192\.168|10|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+):(3000|8081)$/;

/** True when `origin` is an explicitly allow-listed or dev-pattern origin. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return (
    getAllowedOrigins().includes(origin) || DEV_ORIGIN_PATTERN.test(origin)
  );
}
