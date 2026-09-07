import { isAllowedOrigin } from './allowed-origins.js';

describe('isAllowedOrigin', () => {
  const original = process.env.CORS_ORIGINS;

  afterEach(() => {
    process.env.CORS_ORIGINS = original;
  });

  it('accepts an exact allow-listed origin', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    expect(isAllowedOrigin('https://app.example.com')).toBe(true);
    expect(isAllowedOrigin('https://other.example.com')).toBe(false);
  });

  it('rejects a missing origin', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('accepts localhost dev ports without an allow-list entry', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    expect(isAllowedOrigin('http://localhost:5000')).toBe(true);
    expect(isAllowedOrigin('http://localhost:9999')).toBe(false);
  });

  it('expands `*` to match Vercel preview deployments', () => {
    process.env.CORS_ORIGINS = 'https://habit-tracker-web-*.vercel.app';
    expect(
      isAllowedOrigin(
        'https://habit-tracker-web-git-fe-3afede-mehedi-hasans-projects-80c7a4a7.vercel.app',
      ),
    ).toBe(true);
    expect(isAllowedOrigin('https://habit-tracker-web-eight.vercel.app')).toBe(
      true,
    );
  });

  it('keeps `*` inside a single hostname label', () => {
    process.env.CORS_ORIGINS = 'https://habit-tracker-web-*.vercel.app';
    expect(isAllowedOrigin('https://habit-tracker-web-x.evil.com')).toBe(false);
    expect(
      isAllowedOrigin('https://habit-tracker-web-x.attacker.vercel.app'),
    ).toBe(false);
    expect(isAllowedOrigin('https://evil.com/habit-tracker-web-x')).toBe(false);
  });

  it('recompiles when the allow-list changes at runtime', () => {
    process.env.CORS_ORIGINS = 'https://a-*.vercel.app';
    expect(isAllowedOrigin('https://a-1.vercel.app')).toBe(true);
    process.env.CORS_ORIGINS = 'https://b-*.vercel.app';
    expect(isAllowedOrigin('https://a-1.vercel.app')).toBe(false);
    expect(isAllowedOrigin('https://b-1.vercel.app')).toBe(true);
  });
});
