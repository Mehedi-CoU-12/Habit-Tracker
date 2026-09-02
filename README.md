# 🌱 HabitFlow

A habit tracker where every habit is a plant. Stay consistent and watch it grow from a seed to a sprout to a flower — miss a day and it wilts.

Built as a monorepo with a shared NestJS API powering both a web app and a mobile app.

> 📖 **New here? Read [docs/README.md](docs/README.md)** — a beginner-friendly tour of the whole
> architecture with diagrams: how a request travels, how authentication works end to end, the
> data model, caching, the mobile offline engine, and deployment.

## What's inside

| App / Package                | Description                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                   | [NestJS](https://nestjs.com/) backend — REST API, JWT auth, Prisma 7 + PostgreSQL, Redis caching, Cloudinary uploads |
| `apps/web`                   | [Next.js 16](https://nextjs.org/) + React 19, Tailwind CSS v4, TanStack Query, Recharts                              |
| `apps/mobile`                | [Expo](https://expo.dev/) / React Native app (Expo Router)                                                           |
| `packages/ui`                | Shared React UI components                                                                                           |
| `packages/eslint-config`     | Shared ESLint config                                                                                                 |
| `packages/typescript-config` | Shared `tsconfig.json` presets                                                                                       |

## Getting started

**Requirements:** Node.js 22+, pnpm 9, PostgreSQL, and Redis.

```sh
# 1. Install dependencies
pnpm install

# 2. Set up environment variables (copy and fill in each .env.example)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# 3. Apply the database schema
pnpm --filter api exec prisma migrate dev

# 4. Run the web app + API
pnpm dev
```

The API runs on port `3333` and the web app on [http://localhost:3000](http://localhost:3000).

### Running the mobile app

```sh
cd apps/mobile
npm install
npx expo start
```

## Scripts

Run from the repo root:

| Command            | What it does                   |
| ------------------ | ------------------------------ |
| `pnpm dev`         | Start all apps in development  |
| `pnpm build`       | Build all apps                 |
| `pnpm lint`        | Lint the whole workspace       |
| `pnpm check-types` | Type-check the whole workspace |
| `pnpm format`      | Format with Prettier           |

Target a single app with a filter, e.g. `pnpm dev --filter=web`.

## Tech stack

Turborepo · pnpm · TypeScript · NestJS · Prisma · PostgreSQL · Redis · Next.js · React · Tailwind CSS · Expo / React Native
