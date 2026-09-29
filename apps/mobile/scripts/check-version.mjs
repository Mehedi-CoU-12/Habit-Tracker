/** Refuses a build whose version isn't above the one published to installed apps. */
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const { version } = read("../package.json");
const env = read("../eas.json").build.preview.env;

const parts = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
function newer(a, b) {
    const [pa, pb] = [parts(a), parts(b)];
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
    }
    return false;
}

let latest = null;
try {
    const res = await fetch(
        `${env.EXPO_PUBLIC_API_URL}/app/version?platform=android`,
        {
            headers: { "x-app-client": env.EXPO_PUBLIC_APP_CLIENT_KEY },
            signal: AbortSignal.timeout(60_000),
        },
    );
    latest = res.ok
        ? ((await res.json().catch(() => null))?.latest ?? null)
        : null;
    if (!res.ok)
        console.warn(`! Version check skipped: API answered ${res.status}.`);
} catch (err) {
    console.warn(`! Version check skipped: ${err.message}`);
}

const override =
    process.env.ALLOW_PUBLISHED_VERSION === "1" && latest === version;
if (latest && !newer(version, latest) && !override) {
    console.error(
        `\n✗ This build is ${version}, but ${latest} is already published.\n` +
            `  Run \`npm run bump\` (or bump:minor) first, then build again.\n` +
            `  Published it before building? ALLOW_PUBLISHED_VERSION=1 npm run build:android\n`,
    );
    process.exit(1);
}
console.log(`✓ Building ${version}${latest ? ` (published: ${latest})` : ""}`);
