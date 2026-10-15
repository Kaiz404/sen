# Sen build plan

How Sen gets built in about 3 days by coding agents, on `master` only. It assumes the recommendations in [DECISIONS.md](DECISIONS.md). Any owner pick that differs gets folded in before phase 0 starts. Development starts only on the owner's go.

## How to read this

- **Boxes.** One box is one unit of work. Check it only when its evidence exists, such as a passing command, a screenshot, a test name or a commit.
- **Phases.** Each phase ends in a check an agent can run without a human. A phase doesn't start until the one before it is green.
- **Lanes.** Lanes in the same phase run in parallel, each in its own git worktree, and touch only the folders they own.
- **Verification.** Tests alone are not enough. A phase is verified when its unit, device and perf boxes are all checked. A phase with no perf box says so.

## The checks every agent runs

| Check | Command | When |
| --- | --- | --- |
| Fast gate | `npm run check` (`tsc --noEmit`, `expo lint`, `jest --ci`) | Before every commit. The pre-commit hook runs typecheck and related tests |
| One screen state | `adb shell am start -d "sen://dev/states?screen=<s>&state=<t>"`, then `adb exec-out screencap -p > shots/<s>-<t>.png` | After any UI change |
| A flow | `npx agent-device@0.21.28 snapshot -i`, `press`, `screenshot`, plus `adb -e emu finger touch 1` for biometrics | After any flow change |
| Release perf | `npx expo run:android --variant release`, then `flashlight test` with `scripts/scroll.sh` | Phase 3 and phase 8 |

Screenshots go in `shots/`, which is git-ignored. Every perf number gets its seed size and build type written next to it.

## Phase 0. Scaffold and toolchain (serial, one agent)

**Owns.** `package.json`, the lockfile, every config file, `.github/`, `.githooks/`, `scripts/`.

- [ ] Scaffold with `npx create-expo-app --template default@sdk-57` into the repo root. Keep the React Compiler and typed routes on.
- [ ] Install every dependency the whole app needs, using `npx expo install`, so no later lane edits `package.json`.
  - [ ] expo-sqlite with `useSQLCipher`, expo-secure-store, expo-crypto, expo-local-authentication, expo-screen-capture, expo-network, expo-haptics, expo-font, react-native-svg, Reanimated, gesture-handler.
  - [ ] TanStack Query, zod, zustand, react-native-unistyles, react-native-nitro-modules, react-native-mmkv 4.3.x.
  - [ ] `@shopify/flash-list@2.3.3`, excluded from the install check.
  - [ ] jest-expo, RNTL 14, test-renderer.
- [ ] Config. Strict tsconfig with `@/*` on `src/`. ESLint zones, no-cycle, no-console, a raw-hex ban and a `.value` ban. `android.allowBackup: false`. The Bricolage and Plex fonts through the expo-font plugin.
- [ ] `npm run check` script, a `.githooks/pre-commit` hook set by `prepare`, and a GitHub Actions workflow for push.
- [ ] Device bridge. One adb server shared by WSL and Windows, the emulator console token copied into WSL, the `Sen_API36` AVD created with a PIN and an enrolled fingerprint, then snapshotted.
- [ ] Spike D1. SQLCipher links: `PRAGMA cipher_version` returns a value, and the database file doesn't start with `SQLite format 3`.
- [ ] Spike D8. Unistyles runs with Reanimated and the compiler, and a theme switch re-renders nothing.
- [ ] Spike D16. `renderRouter` works under RNTL 14.

**Verify, unit.** `npm run check` is green on the empty app. CI is green on GitHub.
**Verify, device.** The first dev build installs on the emulator. A screenshot is not black. `finger touch` dismisses a test prompt.
**Verify, perf.** None in this phase.

## Phase 1. Contracts (serial, one agent)

**Owns.** `src/models/`, `src/theme/`, `src/app/_layout.tsx` and every route file as a stub, `src/services/db/` (port, schema, migrations, the Node adapter).

- [ ] zod schemas, the `Transaction` model with `source`, the money helpers (integer sen, the sign added by hand, split numerals, spoken amounts).
- [ ] Theme tokens for light and dark from DESIGN.md, with typed Unistyles themes.
- [ ] Every route stubbed under `Stack.Protected`, and the dev states route behind `__DEV__`.
- [ ] Database port (`all`, `run`, `transaction`) with an expo-sqlite adapter and a `node:sqlite` adapter for Jest. Schema v1, the covering index and the `day` column.

**Verify, unit.** Money, schema and migration tests pass on real SQL in Jest.
**Verify, device.** Every stub route opens by deep link. Locked deep links land on Lock.
**Verify, perf.** None in this phase.

## Phase 2. Foundations (three parallel lanes)

**Lane 2a. Components and the states gallery.** Owns `src/components/`, `src/app/(dev)/`.
- [ ] Key, Segmented, ReceiptSlip (perforated top, zigzag bottom), Stamp, Tag, Toast, and `Amount` (coins for `null`, digits otherwise).
- [ ] Sen as static poses from DESIGN.md (the rig, no motion yet).
- [ ] The gallery renders any screen state from fixtures.
- **Unit.** A masked `Amount` renders no digits and is labelled "Amount hidden".
- **Device.** Gallery screenshots of every component in light and dark.

**Lane 2b. Data.** Owns `src/services/` except `db/`.
- [ ] The seeded generator (the first 20 rows match the boards), the mock bank with a `seq` cursor and fault injection, `sync()` with an idempotent upsert.
- [ ] Masked and revealed queries, keyset pages, month and day sums, search.
- [ ] The vault key in SecureStore. Open, lock and close, sign-out and erase.
- **Unit.** Sync twice and interrupted give the same table hash. Masked results hold no amounts. Search "entral" matches a JS filter.
- **Perf.** Jest benches on 10k rows stay inside the D20 budgets.

**Lane 2c. Auth.** Owns `src/features/auth/`, the lock and welcome routes.
- [ ] The session reducer as a pure table, the Zustand store, `useStepUp`, the AppState and idle locks, and the iOS inactive guard.
- [ ] Welcome, the Face ID primer and the Lock screens with every error code mapped.
- **Unit.** Every state and event pair. `BACKGROUND` during `authenticating` is ignored. Re-lock at 61 s, not 59 s.
- **Device.** Launch, Lock, `finger touch`, then History. A wrong finger shows "Not quite."

## Phase 3. History list (one agent)

**Owns.** `src/features/transactions/` (list, view models, reveal).

- [ ] `buildHistoryRows()`, FlashList with sticky day tops, memoised rows, the month card, search, All/In/Out, pull-to-refresh with Sen spinning in the header, the offline banner and the full error.
- [ ] Reveal through the revealed-only amounts map and one shared progress value. The ring, the last 10 s and re-mask.

**Verify, unit.** 10k rows mount fewer than 60 row components. The list's `data` reference survives reveal. The masked tree has no seeded amount, totals included.
**Verify, device.** Gallery states (loading, empty, offline, bad data) and the reveal flow: reveal, wait for expiry, coins come back.
**Verify, perf.** A Flashlight run on a release build with 10k rows hits 55 FPS or more. Unlock to first paint is 500 ms or less.

## Phase 4. Features (four parallel lanes)

**Lane 4a. Detail.** Owns `src/features/detail/`, `src/app/transaction/`.
- [ ] Masked and revealed detail, the timeline, copy reference, share receipt (revealed only), not found.

**Lane 4b. Add and delete.** Owns `src/features/add/`, `src/app/add/`.
- [ ] Keypad reducer, details step with the sanitiser, review, save with step-up and an idempotency key, Undo, the discard guard, delete with step-up.
- [ ] A double-tap on Save stores one row.

**Lane 4c. Settings.** Owns `src/features/settings/`, `src/app/settings/`.
- [ ] Every row in DESIGN.md's settings table, reviewer controls including dataset size, and the sheets as form-sheet routes.
- [ ] Each forced fault renders its designed state.

**Lane 4d. Sen motion.** Owns `src/features/sen/`.
- [ ] MotionDirector reducer, the primitives, the app moments, and reduced motion and the Calm setting.
- [ ] Only one Sen animates. Its device evidence is an `agent-device record` of unlock and reveal.

**Verify, unit.** Each lane's reducer and component tests pass.
**Verify, device.** One agent-device flow per lane, saved as screenshots.
**Verify, perf.** None in this phase. Phase 8 reruns phase 3's perf.

## Phase 5. Security extras (one agent)

**Owns.** `src/features/security/`, `src/features/activity/`.

- [ ] The screen guard (off in dev builds, forced on in release, with a test), the privacy cover, the activity log (cut first if late) and erase.

**Verify, unit.** The release config always guards. The log schema rejects amounts.
**Verify, device.** The recents view shows the cover. A release build's screenshot of History is black.
**Verify, perf.** None in this phase.

## Phase 6. Polish (one agent)

- [ ] Copy, accessibility labels, haptics, Sen's placement on every screen, dark mode check against the `SF-Dark-*` boards.

**Verify.** `snapshot -i` shows every designed label. Screenshots match the canvas boards side by side.

## Phase 7. Docs

- [ ] Rewrite README run steps, the "What this does not protect against" section, the decision summary and the perf numbers with how they were measured.
- [ ] Fold the final picks into ARCHITECTURE.md, then delete DECISIONS.md's open blanks.

## Phase 8. Release

- [ ] EAS `preview` APK on a tag. Fresh install on the emulator and your phone.
- [ ] Smoke flow end to end. `sen://dev/states` lands on Lock. A grep of the release bundle finds no dev flags.
- [ ] Rerun the phase 3 Flashlight test on your phone. Record the numbers.
- [ ] Optional iOS simulator build on EAS if time allows.

## Time budget

| Day | Phases |
| --- | --- |
| 1 | 0, 1, 2 |
| 2 | 3, 4 |
| 3 | 5 to 8 |

Sen motion (4d) is the most likely to overrun. It is isolated, so it can slip without blocking release.

**Cut order if time runs short.**
1. Activity log, clear log and erase.
2. Sync progress line (seed straight into the database instead).
3. The custom Sen pull gesture (keep `RefreshControl`).
4. Infinite pages (load the filtered set in one query).

Keep SQLCipher, masked queries and step-up. They carry the security story.

## Risks

| Risk | Phase | Watch |
| --- | --- | --- |
| SQLCipher doesn't build from WSL | 0 | Fall back to D1 option A, capped at 1k rows |
| Unistyles clashes with worklets or the compiler | 0 | Fall back to StyleSheet with typed tokens |
| `renderRouter` breaks under RNTL 14 | 0 | Test the guard by rendering the layout with a fake store |
| FlashList sticky headers jump on RN 0.86 | 3 | Switch to Legend List's SectionList |
| Emulator fingerprint isn't Class 3 for `'strong'` | 2c | Test early. Note the result in ARCHITECTURE.md |
| Emulator FPS too noisy to gate | 3 | Gate on your phone instead |
