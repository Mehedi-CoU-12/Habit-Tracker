# HabitFlow — Mobile (Expo)

The Bloom "habits-as-plants" design, built with **React Native + Expo (SDK 56)**
and **expo-router**. It talks to the **same NestJS API** as the web app
(`apps/api`) — same auth, same Postgres data. A habit added on web shows up here
and vice-versa.

## Stack
- Expo Router (file-based routing) · React 19 · RN 0.85 (New Architecture)
- `react-native-svg` — the signature `Plant` graphic + icons
- `@tanstack/react-query` — data fetching against the API
- `expo-secure-store` — encrypted JWT + UI prefs
- `@expo-google-fonts/*` — Caprasimo / Manrope / JetBrains Mono
- `expo-linear-gradient` — the sky→cream washes

## Configure the API URL
Mobile can't reach `localhost` from a device/emulator. Set it in `.env`:

```
EXPO_PUBLIC_API_URL=http://<your-machine-LAN-IP>:3333
```

- **Android emulator** reaches the host at `http://10.0.2.2:3333` (used as the
  default on Android when the env var is unset).
- **Physical device** (Expo Go): use your computer's LAN IP and make sure the
  API (`apps/api`, port 3333) and the phone are on the same network.

## Run
```bash
# from repo root, start the API first:
cd apps/api && pnpm dev

# then the mobile app:
cd mobile
npm install        # already done once
npx expo start     # press a (Android), i (iOS), or scan the QR in Expo Go
```

## Structure
```
src/
  app/                     # expo-router routes
    _layout.tsx            # providers (Query, Theme, Auth) + auth gate
    login.tsx, signup.tsx  # auth (token -> SecureStore)
    onboarding.tsx         # 3-step welcome flow
    add.tsx                # new-habit modal
    habit/[id].tsx         # habit detail
    (tabs)/                # Today / Calendar / Stats / Settings + floating tab bar
  theme/                   # makeTheme tokens + ThemeProvider (accent/dark/density/layout)
  components/              # Plant, Icon, HabitRow, primitives
  api/                     # client, endpoints, AuthProvider, react-query hooks
  lib/                     # types, deriveStats, date helpers, storage
```

The theme system mirrors the web app: 4 accents (coral/fern/sky/berry), light/dark,
cozy/compact density, and a garden/list Today layout — all in **Settings**, persisted.
