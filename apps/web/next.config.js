/* global process */

/**
 * @param {string} phase - one of Next's PHASE_* constants (see next/constants)
 * @returns {import('next').NextConfig}
 */
export default function nextConfig(phase) {
    // "phase-development-server" is the value of PHASE_DEVELOPMENT_SERVER;
    // compared as a literal to avoid importing next/constants into the config.
    const isDev = phase === "phase-development-server";
    const apiOrigin = new URL(
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333",
    ).origin;

    // Content-Security-Policy. The access token lives in localStorage (forced
    // by a cross-site web↔API topology — vercel.app vs onrender.com — where
    // cookies aren't viable), so the load-bearing directive here is
    // `connect-src`: an XSS payload may be able to *read* the token, but it
    // can't POST it to an attacker-controlled host, because fetch/XHR/WebSocket
    // may only reach our own origin and the API. `img-src`, `base-uri`,
    // `object-src` and `form-action` close the other common exfil channels.
    //
    // `script-src`/`style-src` carry 'unsafe-inline' because Next.js emits
    // inline bootstrap/hydration scripts and next/font emits an inline
    // @font-face <style>, and a per-request nonce can only be minted in
    // middleware — not in this static config. Locking scripts to a nonce (via
    // middleware.ts + 'strict-dynamic') is the natural next hardening step. Dev
    // additionally needs 'unsafe-eval' (React Refresh) and the HMR websocket.
    const csp = [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com`,
        `font-src 'self' data:`,
        `connect-src 'self' ${apiOrigin}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
        ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const securityHeaders = [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
        },
    ];

    return {
        images: {
            remotePatterns: [
                {
                    protocol: "https",
                    hostname: "res.cloudinary.com",
                },
                {
                    protocol: "https",
                    hostname: "*.googleusercontent.com",
                },
            ],
        },
        async headers() {
            return [{ source: "/(.*)", headers: securityHeaders }];
        },
    };
}
