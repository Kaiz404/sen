# Sen: agent instructions

Sen is a take-home assignment: a secure transaction history module in React Native and TypeScript. The source brief is `../take-home-assessment.md`. The reviewers judge the app, the code and the git history. The goal is to impress: premium, production ready and frontend only.

Read before working:
- [DESIGN.md](DESIGN.md) for any UI, Sen or motion work. For Sen, also the boards in [`design/`](design/), which win over DESIGN's tables.
- [DECISIONS.md](DECISIONS.md) for every technical choice and why it won. Don't reopen one without the owner.
- [PLAN.md](PLAN.md) for the build order, lanes and the checks each phase must pass.
- [ARCHITECTURE.md](ARCHITECTURE.md) for any code.
- [README.md](README.md) for what the reviewer sees.

## Locked decisions

Everything below is decided. Don't reopen it without the owner. Other options were tried and dropped. Technical choices live in DECISIONS.md.

| Area | Decision |
| --- | --- |
| Scope | Mobile frontend only. An in-app mock bank API. No backend, no Go server. Local first, built for 10,000 transactions |
| Repo | One Expo app at the repo root. No monorepo. Shares nothing with Moni (`../moni`) except copied setup patterns |
| Platform | Expo SDK 57, RN 0.86, TypeScript strict, expo-router, React Compiler on |
| Data | Encrypted SQLite (SQLCipher) is the source of truth. The mock bank syncs into it. TanStack Query reads it. MMKV for prefs only |
| UI | FlashList 2.3.3, Unistyles 3, Zustand around the session reducer, react-native-svg and Reanimated for Sen |
| Sign-in | "Continue as demo user", then device biometrics with passcode fallback. No Google sign-in, no accounts |
| Visual direction | X1P: Bricolage Grotesque 800, receipt slips, cream, ink and pastels, masked amounts as four lemon coins |
| Mascot | Sen the coin with hands (MAX rig). Paws never cover the eyes. Eyes close when masked |
| Features | Everything in README "What it does", including manual add and delete, and the security layer |
| Edit | No editing transactions. Delete and add again |
| Security | Step-up biometrics for every write, mask at the source, idle and background lock |
| Tests | Unit and component tests are the test suite (jest-expo, RNTL v14). Maestro flows exist only for agents to verify their work on the device (the owner's phone over Tailscale, `npm run device:verify`). They are not a shipped E2E suite |
| Builds | Android arm64 dev builds from WSL onto the owner's phone over Tailscale. The Windows emulator is a fallback only. EAS only for the reviewer APK, built on tags |
| Delivery | Android APK first. Source second. iOS simulator build as a bonus. No Expo Go |

**Open:**
- Confirm the delivery route against the reviewers' reply, if they answer.
- Fill `[REPO URL]` once the GitHub repo exists.

## Code rules

- **Layers.**
  - `models/` imports nothing.
  - `services/` owns all I/O and parses everything with zod before it leaves.
  - `features/` hold logic and screens.
  - `components/` are design-system primitives.
  - `app/` routes stay thin.
- **Money.** Integer sen (`amountMinor`), never floats. Format with `Intl` and add the sign by hand.
- **Mask at the source.** Masked view models carry `amount: null`. Components never receive a raw `Transaction`.
- **Never log amounts.** All logging goes through `services/logger.ts` using event codes. No `console.` anywhere else.
- **Writes need step-up.** Add, delete, clear log and erase go through `useStepUp`, every time, never cached.
- **Never auto-prompt biometrics on resume.** Guard every prompt with `isAuthenticatingRef`. Lock only on `background`.
- **Randomness.** `expo-crypto` `getRandomValues` or `randomUUID`. Never `getRandomBytes` or `Math.random` for anything security-related.
- **Styling.** Use semantic tokens from the Unistyles theme in `src/theme/`, never raw hex in screens. Touch targets are at least 44 pt.
- **Motion.**
  - Reanimated on the UI thread.
  - Sen's motion is data. Add or change a moment in `src/features/sen/moments/`, never as a hand-written worklet.
  - Read the motion level only through `useMotionPolicy()`, never `useReducedMotion()`. Informational timers such as the lockout cool-down use `ReduceMotion.Never`.
  - Only one Sen animates at a time, through the MotionDirector. No Sen inside a list row. No animation state in list rows.
  - Prove motion with `npm run test:motion` (literal values at start, midpoint and end), then the Maestro screenshot flow on settled screens. Never approve your own screenshot baselines. Keep the device's animation scales on.
- **Versions.**
  - Install Expo packages with `npx expo install`.
  - Keep the bundled Reanimated (4.5.1), Worklets (0.10.1) and Gesture Handler (~2.32).
  - Pin MMKV to 4.3.x.
- **Tests.** Every security property in ARCHITECTURE.md › Tests gets its test in the same commit as the code.
- **Copy.** Short, warm and plain. Sen is "it".

## Git

- Work on `main` only. No branches, no PRs.
- Commit small and often. The history is part of the submission. Every commit builds.
- Messages are short and lower case, `type: what changed`. Examples: `feat: biometric lock`, `fix: lockout timer drift`, `docs: decision records`.
- No AI attribution lines (no `Co-Authored-By`, no "Generated with") in commits.
- Never commit secrets, `.env` files, keystores or `credentials.json`.

## Environment

- WSL2 on Windows. No Mac, no Xcode.
- The Android SDK is at `~/Android/Sdk` (with NDK and build-tools) and JDK 17 is installed. `~/.bashrc` sets `ANDROID_HOME` and puts `adb` on `PATH`.
- **Device loop.** The owner's phone is the default device: a Redmi Note 13 Pro 5G (HyperOS, arm64) on Tailscale at `100.127.128.74`. adb reaches it over Wireless debugging through the one adb server on Windows.
  - **Pair once.** On the phone, turn on Developer options > Wireless debugging, tap Pair device with pairing code, then run `. scripts/device-env.sh && adb pair 100.127.128.74:<pairing port> <code>`. Put `PHONE_ADB=100.127.128.74:<port>` in `.device.env`, which is git-ignored. The port is on the Wireless debugging screen.
  - **Xiaomi toggles.** Developer options > USB debugging (Security settings) lets Maestro tap. Install via USB lets `adb install` work. Both need a Mi account. Every install still shows an Install via USB sheet that denies itself after 10 s, so someone taps Install. Ticking Remember my choice skips the sheet after that.
  - **`npm run device:verify`** is the one command. It runs `scripts/phone.sh`, starts Metro on 8081 if it is down, opens the dev client, then runs every unattended flow in `.maestro/` plus `screenshots.yaml` in one `maestro test`. It prints a pass or fail row per flow, the shot count and the run folder `shots/runs/<timestamp>`, and exits non-zero on any failure. `--only 'auth-*'` runs a subset. Flows tagged `needs-human` (a real fingerprint) run only when `--only` names them. It refuses a Metro on 8081 that serves another folder.
  - **`scripts/phone.sh`** is safe to rerun. It connects, finds the new port by probing the phone when Wireless debugging has restarted, keeps the screen on for 30 minutes, refuses while the keyguard shows, sets `adb reverse tcp:8081 tcp:8081`, and installs the arm64 dev build when the phone's copy differs from `android/app/build/outputs/apk/debug/app-debug.apk`. It runs `cmd package compile -m speed` after an install. `scripts/phone.sh --release` restores the phone's screen timeout.
  - **Auth in flows.** No agent can touch a real sensor, so flows set the dev-only auth override through `sen://dev/states?auth=pass|fail|cancel|lockout|real`. `.maestro/subflows/at-lock.yaml` cold-starts on Lock with the outcome it is given, and sets up a fresh install first.
  - `. scripts/device-env.sh` points WSL's adb at the Windows server and exports `ANDROID_SERIAL` from `.device.env`, so every adb and Maestro call targets the phone.
  - **Build.** The phone needs the arm64 dev build: `cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`, then `./gradlew --stop`. It took 17 minutes from clean. The emulator build is x86_64 and writes the same APK path, and `phone.sh` refuses an APK without arm64 code.
  - Use `--clear` only after route files are added or moved or the Babel or Metro config changes: `npx expo start --localhost --clear`. A long-running Metro once kept serving the old route tree, and every new deep link showed "Unmatched Route". Otherwise `npm start` keeps the transform cache.
  - **Host memory.** Run one heavy thing at a time: one Gradle or native build, then `./gradlew --stop`, and quit Docker Desktop when it isn't needed.
  - Gallery screenshots go through one `maestro test .maestro/screenshots.yaml`, never `uiautomator dump` polling, which is slow and can break Maestro's driver session.
  - Don't put `launchApp` in a flow. On the phone it spends about 34 s before it launches, even with `stopApp: false`. `openLink` brings the app forward. `tapOn` and `openLink` also wait for the screen to stop changing, so a looping animation (a skeleton shimmer, a countdown) costs up to about 30 s per link.
  - `phone.sh` also turns off the dev client's floating gear button through its saved preference (`showFab`), because the gear covers History's lock key and a tap there opens the developer menu.
  - **Emulator fallback.** `scripts/emulator.sh` starts the `Sen_API36` AVD (PIN `1111`, an enrolled fingerprint), boots it cold, enters the PIN and targets `emulator-5554`. It needs about 5.5 GB of free Windows RAM and refuses to boot under 6 GB. Build with `-PreactNativeArchitectures=x86_64` for it. The same flows run there with `ANDROID_SERIAL=emulator-5554`, and `adb -e emu finger touch 1` answers a real prompt.
- Dev builds install on a phone over Tailscale.
- iOS is reached only through EAS cloud builds and can't be verified locally.

## Docs

- Keep six docs: README.md, DESIGN.md, ARCHITECTURE.md, DECISIONS.md, PLAN.md and CLAUDE.md.
- Update the matching doc in the same commit as the change.
- Record decisions as current state, not history.
- Write short declarative sentences in plain words, with no long dashes. Use tables where they help.
- Mark unverified technical claims as inferred.
