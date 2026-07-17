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

/** True when `origin` is an explicitly allow-listed or dev-pattern origin. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return (
    getAllowedOrigins().includes(origin) || DEV_ORIGIN_PATTERN.test(origin)
  );
}
