# Sen: agent instructions

Sen is a take-home assignment: a secure transaction history module in React Native and TypeScript. The source brief is `../take-home-assessment.md`. The reviewers judge the app, the code and the git history. The goal is to impress: premium, production ready and frontend only.

Read before working:
- [DESIGN.md](DESIGN.md) for any UI, Sen or motion work.
- [DECISIONS.md](DECISIONS.md) for every technical choice. A record without an owner pick is not decided. Don't build on it.
- [PLAN.md](PLAN.md) for the build order, lanes and the checks each phase must pass.
- [ARCHITECTURE.md](ARCHITECTURE.md) for any code. Where it conflicts with an owner pick in DECISIONS.md, the pick wins.
- [README.md](README.md) for what the reviewer sees.

## Locked decisions

Everything below is decided. Don't reopen it without the owner. Other options were tried and dropped. Technical choices live in DECISIONS.md.

| Area | Decision |
| --- | --- |
| Scope | Mobile frontend only. An in-app mock bank API. No backend, no Go server. Local first, built for 10,000 transactions |
| Repo | One Expo app at the repo root. No monorepo. Shares nothing with Moni (`../moni`) except copied setup patterns |
| Platform | Expo SDK 57, RN 0.86, TypeScript strict, expo-router. Styling, storage, list, state and tooling are open in DECISIONS.md |
| Sign-in | "Continue as demo user", then device biometrics with passcode fallback. No Google sign-in, no accounts |
| Visual direction | X1P: Bricolage Grotesque 800, receipt slips, cream, ink and pastels, masked amounts as four lemon coins |
| Mascot | Sen the coin with hands (MAX rig). Paws never touch the face. Eyes close when masked |
| Features | Everything in README "What it does", including manual add and delete, and the security layer |
| Edit | No editing transactions. Delete and add again |
| Security | Step-up biometrics for every write, mask at the source, idle and background lock |
| Tests | Unit and component tests only (jest-expo, RNTL v14). No Maestro, no E2E |
| Builds | Local Android dev builds from WSL. EAS only for the reviewer APK, built on tags |
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
- **Styling.** Use semantic tokens from `global.css`, never raw hex in screens. Touch targets are at least 44 pt.
- **Motion.**
  - Reanimated on the UI thread.
  - Respect reduced motion and the "Sen's animations" setting.
  - Only one Sen animates at a time, through the `MotionDirector`.
- **Versions.**
  - Install Expo packages with `npx expo install`.
  - Keep the bundled Reanimated (4.5.1), Worklets (0.10.1) and Gesture Handler (~2.32).
  - Pin MMKV to 4.3.x.
- **Tests.** Every security property in ARCHITECTURE.md › Tests gets its test in the same commit as the code.
- **Copy.** Short, warm and plain. Sen is "it".

## Git

- Work on `master` only. No branches, no PRs.
- Commit small and often. The history is part of the submission. Every commit builds.
- Messages are short and lower case, `type: what changed`. Examples: `feat: biometric lock`, `fix: reveal timer drift`, `docs: decision records`.
- No AI attribution lines (no `Co-Authored-By`, no "Generated with") in commits.
- Never commit secrets, `.env` files, keystores or `credentials.json`.

## Environment

- WSL2 on Windows. No Mac, no Xcode.
- The Android SDK is at `~/Android/Sdk` (with NDK and build-tools) and JDK 17 is installed. `ANDROID_HOME` and `adb` on `PATH` still need setting.
- Dev builds install on a phone over Tailscale.
- iOS is reached only through EAS cloud builds and can't be verified locally.

## Docs

- Keep six docs: README.md, DESIGN.md, ARCHITECTURE.md, DECISIONS.md, PLAN.md and CLAUDE.md.
- Update the matching doc in the same commit as the change.
- Record decisions as current state, not history.
- Write short declarative sentences in plain words, with no long dashes. Use tables where they help.
- Mark unverified technical claims as inferred.
