# Sen

A secure transaction history module for a fintech app, built in React Native and TypeScript as a take-home assignment. The name comes from the sen, the Malaysian cent.

Amounts are hidden until you prove it's you. Sen, a coin with a face, keeps its eyes shut while they're hidden.

**Status:** design and architecture are locked. Development starts next. Run instructions below are the plan and will be confirmed as the app is built.

## What it does

- **Biometric login.** One key. Sen asks for your fingerprint, face unlock or Face ID, and the phone's own sheet falls back to your PIN, pattern, password or passcode. A phone with no biometric goes straight to its screen lock. Clear errors for every failure.
- **Masked by default.** Every amount shows as `RM` and four coins. One biometric check shows every amount, and they stay shown until you hide them again or Sen locks. Every unlock and every launch starts masked. Settings' switch can turn hiding off, which also asks for biometrics.
- **History.** Date-grouped receipt slips, a month summary, All / In / Out filters, live search and pull-to-refresh.
- **Detail.** All fields, a status timeline for pending items, copy reference and share receipt.
- **Add your own transactions.** A custom keypad keeps amounts away from the system keyboard. Saving asks for your biometrics. Added rows are stored encrypted. Only added rows can be deleted. Bank rows are read-only.
- **Security layer.**
  - Biometrics again for every change.
  - Idle lock and re-lock after leaving.
  - A privacy cover in the app switcher.
  - Screenshots blocked on sensitive screens.
  - An encrypted local activity log of the last 50 events. A deleted transaction's description stays in it until it ages out or the log is cleared.
- **Errors you can trigger.** A "For reviewers" section in Settings forces offline, timeout, server error, bad data and slow network.
- **Craft.** Light, dark and system themes, haptics, reduced-motion support, and screen reader labels such as "Amount hidden".

The 20+ simulated transactions come from an in-app mock API with realistic latency. There is no backend.

## How the brief maps to Sen

| Brief | Where |
| --- | --- |
| 1. Biometric authentication | Lock screen, Face ID primer, lock states. [ARCHITECTURE.md › Auth and session](ARCHITECTURE.md#auth-and-session) |
| 2. Simulated JSON transactions, 20+ | `services/bankApi.ts` fixtures, parsed with zod |
| 3. History, masked amounts, biometric reveal, pull-to-refresh | History and Reveal screens |
| 4. Detail screen with all fields | Detail screens |
| 5. Network and auth error handling | Every `LoadError` and auth error has a designed state |
| 6. TypeScript, structure, separation of concerns | `models/`, `services/`, `features/`, `components/`, `app/` |

## Docs

| File | Covers |
| --- | --- |
| [DESIGN.md](DESIGN.md) | Visual system, Sen the mascot, motion, screens, flows, settings |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, layers, state machine, storage, threat model, tests, builds |
| [DECISIONS.md](DECISIONS.md) | Architecture decisions: alternatives compared and why each choice won |
| [PLAN.md](PLAN.md) | Build order, parallel lanes and how each phase is verified |
| [CLAUDE.md](CLAUDE.md) | Working rules for coding agents on this repo |

Design canvas (private, ask the owner for access): https://claude.ai/artifact/8d2qRf6GtxCL9bog1E41fF

## Running Sen (planned)

**Easiest: install the Android APK.** Download it from the latest GitHub release, install it, and enrol a fingerprint on the device or emulator first. No accounts or tools needed.

**From source (Android).** After pulling, rebuild the dev client: the local native module `modules/sen-auth` (screen-lock check) needs a native build.

```bash
# Node 22.13+, JDK 17, Android SDK
npm install
npx expo run:android
```

On an emulator, set a screen PIN and enrol a fingerprint in Settings. Then touch the sensor with `adb -e emu finger touch 1`.

**iOS.** The code targets iOS too. An EAS simulator build will be offered for reviewers with a Mac. Use Features › Face ID › Enrolled in the Simulator. It was built without a Mac, so iOS is untested by the author.

**Expo Go is not supported.** Sen uses native modules (MMKV) and needs its own Face ID permission.

## Tests

```bash
npm test          # unit and component tests
npm run typecheck
npm run lint
```
