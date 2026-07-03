# Deploy the API to Render (free, always-on)

The NestJS API ([apps/api](../apps/api)) runs on **Render's free web service** — no
credit card required. The free instance sleeps after ~15 min of inactivity, so we
keep it awake with a free external pinger. The database stays on **Neon** (already
set up); Render only hosts the API.

> Free-tier facts: 512 MB RAM, 750 instance-hours/month (one always-on service ≈ 730 hrs,
> fits), spins down after ~15 min idle. A ping every ~10 min prevents the spin-down.

---

## 1. Push these changes

This repo now contains:

- [`render.yaml`](../render.yaml) — the service blueprint (build/start commands, env vars).
- `GET /health` endpoint — fast 200, used by the pinger and Render's health check.
- `app.listen(..., '0.0.0.0')` in [main.ts](../apps/api/src/main.ts) — required by Render.

Commit and push to `main` (or your deploy branch).

## 2. Create the service from the blueprint

1. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect your GitHub repo. Render reads `render.yaml` and proposes the
   `habit-tracker-api` web service on the **free** plan.
3. Click **Apply**. It will ask you to fill in the secret env vars (below).

## 3. Environment variables (set in the Render dashboard)

| Key                                                                      | Value                                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                           | Your Neon **pooled** connection string + `?sslmode=require` (use the host containing `-pooler`) |
| `JWT_SECRET`                                                             | A long random string                                                                            |
| `FRONTEND_URL`                                                           | Your Vercel web URL, e.g. `https://your-app.vercel.app` (used for the OAuth redirect)           |
| `CORS_ORIGINS`                                                           | Comma-separated web origins allowed to call the API, e.g. `https://your-app.vercel.app`         |
| `GOOGLE_CLIENT_ID`                                                       | From Google Cloud Console                                                                       |
| `GOOGLE_CLIENT_SECRET`                                                   | From Google Cloud Console                                                                       |
| `GOOGLE_CALLBACK_URL`                                                    | `https://<your-service>.onrender.com/auth/google/callback`                                      |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard                                                                  |

Already set in `render.yaml` (no action): `NODE_VERSION`, `NODE_ENV`, `JWT_EXPIRE`, and `PORT` (Render injects it).

> **Mobile app**: it sends no `Origin` header, so it's allowed by CORS automatically —
> you do **not** need to add it to `CORS_ORIGINS`. Just point the mobile app's API base
> URL at `https://<your-service>.onrender.com`.

## 4. Update Google OAuth

In Google Cloud Console → your OAuth client → **Authorized redirect URIs**, add:

```
https://<your-service>.onrender.com/auth/google/callback
```

(Keep the localhost one for local dev.)

## 5. Migrations

The build command runs `prisma migrate deploy` automatically against `DATABASE_URL`,
so your Neon schema stays in sync on every deploy. (If you'd rather control this
manually, remove that step from `render.yaml` and run
`pnpm --filter api exec prisma migrate deploy` locally against Neon.)

## 6. Keep it awake (the important step)

Without this, the instance sleeps and the first request after idle takes 30–60s —
bad for mobile users.

1. Sign up at <https://cron-job.org> (free, no card).
2. Create a cron job:
    - **URL**: `https://<your-service>.onrender.com/health`
    - **Schedule**: every **10 minutes**
3. Save. The instance now receives traffic every 10 min and never spins down.

## 7. Verify

```bash
curl https://<your-service>.onrender.com/health
# -> {"status":"ok"}
```

Then point the web app (Vercel env) and mobile app at the Render URL.

---

### Honest caveats

- **512 MB RAM** is enough for this app but not generous — watch the Render logs for OOM.
- The keep-alive ping is an unofficial pattern; if a ping ever gaps, the next request is slow.
- If you later outgrow the free tier, the same `render.yaml` works on a paid plan
  (change `plan: free` → `plan: starter`) with no other changes — and a paid instance
  doesn't sleep, so you can drop the cron pinger.
