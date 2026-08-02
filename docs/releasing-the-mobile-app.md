# Releasing the mobile app

How a new build reaches people who already have HabitFlow installed.

The preview APKs are sideloaded, so there is no store to push an update for us.
Instead the API publishes what the newest build is, and every running app checks
it on launch. If the app is behind, it shows a prompt with a **Download update**
button that opens the link below.

## The pieces

| Where                                | What it does                                                       |
| ------------------------------------ | ------------------------------------------------------------------ |
| `apps/api` → `AppRelease` table      | One row per platform: `latest`, `minimum`, `url`, `notes`          |
| `GET /app/version?platform=android`  | Public. What installed apps poll                                    |
| `apps/web` → **Admin → Releases**    | Where you publish. No redeploy needed                              |
| `apps/mobile` → `UpdateGate`         | Compares `expo.version` against the row and shows the prompt        |

## Shipping a release

1. **Bump the version** in `apps/mobile/app.json` → `expo.version` (e.g.
   `1.0.0` → `1.1.0`). This is the number the update check compares.

   > `eas.json`'s `autoIncrement` only bumps Android's `versionCode`, not
   > `expo.version`. That one is yours to raise, and if you forget, every
   > installed app keeps reporting the old version and never sees the update.

2. **Build it.**

    ```sh
    cd apps/mobile
    eas build -p android --profile preview
    ```

3. **Publish the APK to GitHub Releases.** Tag it `v1.1.0`, attach the `.apk`.
   Either link shape works as the download URL:

    - Pinned to one build —
      `https://github.com/Mehedi-CoU-12/Habit-Tracker/releases/download/v1.1.0/habitflow.apk`
    - Always-newest —
      `https://github.com/Mehedi-CoU-12/Habit-Tracker/releases/latest`

   The second is worth preferring: it never goes stale, so from then on a
   release only means changing the version number in step 4.

4. **Publish in the dashboard.** Admin → Releases → Android:

    - **Latest version** → `1.1.0`. Everyone below it gets a dismissible
      "A new version is ready" prompt, once per release.
    - **Minimum supported** → leave alone unless an old client would actually
      break against the current API. Raising it *locks those users out* until
      they update — it's for breaking API changes, not for nagging.
    - **Download URL** → the link from step 3.
    - **Release notes** → optional; shown inside the prompt.

   Saving busts the cache, so apps see it on their next launch or foreground.

## Things that will bite you

- **Same signing key, always.** Android refuses to install an APK over an
  existing app signed with a different key — the user has to uninstall first,
  losing local state. EAS keeps your credentials stable as long as you don't
  regenerate them.
- **"Install unknown apps"** must be allowed for whichever browser opens the
  link. First-time sideloaders will hit a system prompt; that's Android, not us.
- **The first build containing this feature can't announce itself.** Anyone
  already running an older APK has no update check in it, so they need one
  manual nudge. Every release after that is automatic.
- **Version strings are dotted numbers only** (`1`, `1.2`, `1.2.3`). No `v`
  prefix, no `-beta`. The API rejects anything else rather than let a version
  the client can't parse silently never match.

## Testing it without shipping

Set **Latest version** to something above your installed build (e.g. `9.9.9`)
and relaunch the app — the prompt appears. Set it back to the real version to
clear it. To re-test the dismissible prompt after tapping "Not now", either
publish a different version number or reinstall: the dismissal is remembered
against the exact version it was shown for.
