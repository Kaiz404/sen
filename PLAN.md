# Sen build plan

How Sen gets built in about 3 days by coding agents, on `main` only. It follows [DECISIONS.md](DECISIONS.md) and [ARCHITECTURE.md](ARCHITECTURE.md). Development starts on the owner's go.

## How to read this

- **Boxes.** One box is one unit of work. Check it only when its evidence exists, such as a passing command, a screenshot, a test name or a commit.
- **Phases.** Each phase ends in a check an agent can run without a human. A phase doesn't start until the one before it is green.
- **Lanes.** Lanes in the same phase run in parallel, each in its own git worktree, and touch only the folders they own.
- **Routes and seams.** No lane edits `src/app/`. A lane that needs a new route asks the coordinator. Seam names in each feature index are frozen, and their bodies belong to the lane.
- **Verification.** Tests alone are not enough. A phase is verified when its unit, device and perf boxes are all checked. A phase with no perf box says so.

## The checks every agent runs

| Check | Command | When |
| --- | --- | --- |
| Fast gate | `npm run check` (`tsc --noEmit`, `expo lint`, `jest --ci`) | Before every commit. The pre-commit hook runs typecheck and related tests |
| One screen state | `adb shell am start -d "sen://dev/states?screen=<s>&state=<t>"`, then `adb exec-out screencap -p > shots/<s>-<t>.png` | After any UI change |
| A flow | `maestro test .maestro/<flow>.yaml`, with `adb -e emu finger touch 1` for biometrics | After any flow change |
| Release perf | `npx expo run:android --variant release`, then `flashlight test` with `scripts/scroll.sh` | Phase 3 and phase 8 |
| Motion values | `npm run test:motion`: pure maths tables, plus `toHaveAnimatedStyle` and `toHaveAnimatedProps` at start, midpoint and end with literal values from DESIGN.md | Any motion change |
| Settled screenshots | `maestro test .maestro/screenshots.yaml`: `assertScreenshot` on each states-route screen and pose against the owner-approved baselines | Any UI or Sen change |
| Motion video | `maestro test .maestro/record-<moment>.yaml`: `startRecording` for the owner to watch | After the screenshots pass |

Screenshots go in `shots/`, which is git-ignored. Every perf number gets its seed size and build type written next to it.

## Phase 0. Scaffold and toolchain (serial, one agent)

**Owns.** `package.json`, the lockfile, every config file, `.github/`, `.githooks/`, `scripts/`.

- [x] Scaffold with `npx create-expo-app --template default@sdk-57` into the repo root. Keep the React Compiler and typed routes on.
- [x] Install every dependency the whole app needs, using `npx expo install`, so no later lane edits `package.json`.
  - [x] expo-sqlite with `useSQLCipher`, expo-secure-store, expo-crypto, expo-local-authentication, expo-screen-capture, expo-network, expo-haptics, expo-font, react-native-svg, Reanimated, gesture-handler.
  - [x] TanStack Query, zod, zustand, react-native-unistyles, react-native-nitro-modules, react-native-mmkv 4.3.x.
  - [x] `@shopify/flash-list@2.3.3`, excluded from the install check.
  - [x] jest-expo, RNTL 14, test-renderer.
  - [x] Maestro CLI 2.11.x, installed per user. Its flows live in `.maestro/`.
- [x] Config. Strict tsconfig with `@/*` on `src/`. ESLint zones, no-cycle, no-console, and bans on raw hex, `.value`, `useReducedMotion`, `runOnJS` and `'cubic-bezier('` strings. `android.allowBackup: false`. The Bricolage and Plex fonts through the expo-font plugin.
- [x] Jest exactly as in ARCHITECTURE.md › Proving motion works: `jest-expo/android`, the worklets resolver, the React Compiler on, and the react-native-svg mock.
- [x] Maestro from WSL. One adb server on Windows (`adb -a -P 5037 nodaemon server`), WSL pointed at it with `ADB_SERVER_SOCKET=tcp:127.0.0.1:5037` (mirrored networking), and `maestro test` run from WSL, adding `--host 127.0.0.1` if needed. Fallback: install Maestro natively on Windows and run the same `.maestro/` flows.
- [x] A first Maestro flow that opens the app, passes Lock with `finger touch` and lands on History. Leave the emulator's animation scales on.
- [x] `npm run check` script, a `.githooks/pre-commit` hook set by `prepare`, and a GitHub Actions workflow for push.
- [x] Device bridge. One adb server shared by WSL and Windows, the emulator console token copied into WSL, the `Sen_API36` AVD created with a PIN and an enrolled fingerprint. `scripts/emulator.sh` boots it cold and enters the PIN.
- [x] Spike D1. SQLCipher links: `PRAGMA cipher_version` returns a value, and the database file doesn't start with `SQLite format 3`.
- [x] Spike D8. Unistyles runs with Reanimated and the compiler, and a theme switch re-renders nothing.
- [x] Spike D16. `renderRouter` works under RNTL 14.
- [x] Spike D23. An `AnimatedG` driven by a worklet `matrix` draws on the emulator: a test screen with the face slid sideways shows it moved and still clipped. If not, the face slide uses an RN `transform` array.
- [x] One motion test passes: a `withTiming` advanced to its midpoint, and one SVG animated prop asserted with `toHaveAnimatedProps`.

**Verify, unit.** `npm run check` is green on the empty app. CI is green on GitHub.
**Verify, device.** The first dev build installs on the emulator. A screenshot is not black. `finger touch` dismisses a test prompt.
**Verify, perf.** None in this phase.

## Phase 1. Contracts (serial, one agent)

**Owns.** `src/models/`, `src/theme/`, `src/motion/`, `src/app/` (every route file, final), `src/services/db/`, `src/services/query-client.ts`, Sen's data and `SenStatic` in `src/features/sen/`, the seam files in each feature folder, and `src/features/stub/`.

- [x] zod schemas, the `Transaction` model with `source`, the money helpers (integer sen, the sign added by hand, split numerals, spoken amounts). Also `day`, `draft`, `errors` and the `PREFS` table. Evidence: `src/models/*.test.ts`.
- [x] Theme tokens for light and dark from DESIGN.md, with typed Unistyles themes and type roles. Evidence: `src/theme/theme.test.ts` (every text token at 4.5:1 or more).
- [x] Motion contracts in `src/motion/`: `tokens.ts` (the canvas easing curves, springs, durations), `policy.tsx` (`useMotionPolicy`, `<MotionPolicyRoot>`), `timeline.ts` (`kf`, `useLoopClock`), `countdown.ts` (`useSecondsLeft`, `useCountdownProgress`, `ringOffset`, `useRevealPhase`) and `threshold.ts` (`useThreshold`). Evidence: `src/motion/*.test.tsx`.
- [x] Sen's data in `src/features/sen/`: `channels.ts`, `poses.ts` and `art/` (geometry, `mat()`, `NODES`, `SVG_TREE`), ported from the canvas kit. Evidence: `poses.test.ts`, `art/nodes.test.ts`.
- [x] `SenStatic` for every pose and tier, drawn from the shared node table. Evidence: `components/sen-static.test.tsx`.
- [x] Every route stubbed under `Stack.Protected`, and the dev states route behind `__DEV__`. Evidence: `src/__tests__/guard.test.tsx`, `src/__tests__/lock-flow.test.tsx`.
- [x] Database port (`all`, `run`, `transaction`) with an expo-sqlite adapter and a `node:sqlite` adapter for Jest. Schema v1, the page index and the `day` column. Evidence: `src/services/db/*.test.ts`.
- [x] Lint keeps `node:sqlite` and `db/testing` in test files and bans `withExclusiveTransactionAsync`. Evidence: each rule fired on a temporary bad import, then the file was removed.

**Verify, unit.** Money, schema and migration tests pass on real SQL in Jest. Every pose has exactly one mouth and one eye state. `resolveMotion` table passes.
**Verify, device.** Every stub route opens by deep link. Locked deep links land on Lock. `sen://dev/states?screen=db` shows a `cipher_version`, `user_version 1` and `day 2026-10-16`. Passed on 2026-10-16 on `Sen_API36`: 13 protected and unknown links while locked showed Lock, every stub route opened once unlocked, a locked link was not replayed after unlock (History), and the smoke read `cipher_version 4.7.0 community`, `user_version 1`, `day 2026-10-16`.
**Verify, perf.** None in this phase.

## Phase 2. Foundations (three parallel lanes)

**Lane 2a. Components and the states gallery.** Owns `src/components/` and `src/features/gallery/`.
- [ ] Key (Gesture Handler `Pressable`, face sliding onto a static shadow plate), Segmented (percent-translate pill), ReceiptSlip, Stamp, Tag, ToastHost, EnterOnce, Bone, Countdown, and `Amount` (coins for `null`, digits otherwise).
- [ ] Show every pose and tier on the gallery (`?screen=sen&pose=&size=`). Phase 1 built `SenStatic`.
- [ ] The gallery renders any screen state from fixtures.
- **Unit.** A masked `Amount` renders no digits and is labelled "Amount hidden". `pressIn` moves a Key 4 px. Pressing "In" moves the pill to `100%`. The Countdown label reads `0:10 LEFT` at 50 s.
- **Device.** Gallery screenshots of every component in light and dark. Maestro screenshots of all 12 poses at 32, 72 and 200 pt, compared side by side with the canvas boards and approved by the owner as baselines.

**Lane 2b. Data.** Owns `src/services/` except `db/`.
- [ ] The seeded generator (the first 20 rows match the boards), the mock bank with a `seq` cursor and fault injection, `sync()` with an idempotent upsert.
- [ ] Masked and revealed queries, keyset pages, month and day sums, search.
- [ ] The vault seam (`services/vault.ts`). The database key in SecureStore, open, sign-out, erase and the missing-key reset.
- [ ] The prefs seam (`services/prefs.ts`) on MMKV, plus `logger.ts`, `sanitize.ts` and `haptics.ts`.
- **Unit.** Sync twice and interrupted give the same table hash. Masked results hold no amounts. Search "entral" matches a JS filter.
- **Perf.** Jest benches on 10k rows stay inside the D20 budgets.

**Lane 2c. Auth.** Owns `src/features/auth/`.
- [ ] The session reducer as a pure table, the Zustand store holding the open database (`useDb()`), `useStepUp`, the AppState and idle locks, and the iOS inactive guard.
- [ ] Welcome, the Face ID primer and the Lock screens with every error code mapped.
- **Unit.** Every state and event pair. `BACKGROUND` during `authenticating` is ignored. Re-lock at 61 s, not 59 s.
- **Device.** Launch, Lock, `finger touch`, then History. A wrong finger shows "Not quite."

## Phase 3. History list (one agent)

**Owns.** `src/features/transactions/` (list, view models, reveal).

- [ ] `buildHistoryRows()`, FlashList with sticky day tops, memoised rows, the month card, search, All/In/Out, pull-to-refresh with Sen spinning in the header, the offline banner and the full error.
- [ ] Reveal through the revealed-only amounts map and `<RevealProgressProvider>`. The ring (`useCountdownProgress`, `ReduceMotion.Never`), the last 10 s (`useRevealPhase`) and re-mask, with data removed before the coins animate.
- [ ] Spike R2. Insert a row under Today with FlashList's keep-scroll-position on, at the top and scrolled 400 px. Pick the setting that slides the row in without a jump.
- [ ] Spike R3. Profile the reveal commit on a release build with 10k rows. Under 50 ms on the emulator, or switch to one animated view per amount.

**Verify, unit.** 10k rows mount fewer than 60 row components. The list's `data` reference survives reveal. The masked tree has no seeded amount, totals included. Digit column 0 is mid-roll at 100 ms. Zero parent renders during the roll.
**Verify, device.** Gallery states (loading, empty, offline, bad data) and the reveal flow: reveal, wait for expiry, coins come back.
**Verify, perf.** A Flashlight run on a release build with 10k rows hits 55 FPS or more. Unlock to first paint is 500 ms or less.

## Phase 4. Features (four parallel lanes)

**Lane 4a. Detail.** Owns `src/features/detail/`.
- [ ] Masked and revealed detail, the timeline, copy reference, share receipt (revealed only), not found.

**Lane 4b. Add and delete.** Owns `src/features/add/`.
- [ ] Keypad reducer, details step with the sanitiser, review, save with step-up and an idempotency key, Undo, the discard guard, delete with step-up.
- [ ] A double-tap on Save stores one row.

**Lane 4c. Settings.** Owns `src/features/settings/`.
- [ ] Every row in DESIGN.md's settings table, reviewer controls including dataset size, and the sheets as form-sheet routes.
- [ ] Each forced fault renders its designed state.

**Lane 4d. Sen motion.** Owns `src/features/sen/`. Build in this order, each step green before the next.
- [ ] `SenRig`: four body Views plus animated SVG nodes, one channel per node, and `usePose`. A test checks that a settled rig shows the same values as `SenStatic`.
- [ ] `compileTrack`, `eulerSteps`, `edgeSpin`. Tests assert literal values (for example, wobble amplitudes 11, 7.92, 5.70).
- [ ] Director reducer as a table test, then its store with gates and the idle scheduler, then the two-rigs test (only one animates).
- [ ] Unlock, Reveal and Re-mask as data from DESIGN.md's tables. `toHaveAnimatedStyle` and `toHaveAnimatedProps` at start, midpoint and end with literal values. Calm and Off forms.
- [ ] The remaining moments, P3 down to P0, then idle and ambient loops.
- [ ] Turn on `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`, rebuild, and run the smoothness gate on a looped Unlock.
- **Device.** A Maestro flow per moment that triggers it, waits with `waitForAnimationToEnd`, then asserts the settled screen. A recording of each moment in Full and Calm goes to the owner to watch.
- **Perf.** Release build on the owner's phone with the Perf Monitor while Unlock and Reveal play. A Jest render counter shows no React commits during a moment.

**Lane 4e. Pull-to-refresh gesture (optional).** Owns `src/features/transactions/pull/`.
- [ ] Spike R1 first. A `Gesture.Pan` with `Gesture.Native` over FlashList pulls on `adb shell input swipe`, fires the threshold once, and five normal scrolls still scroll. If it fails, keep `RefreshControl` (cut 3).

**Verify, unit.** Each lane's reducer and component tests pass.
**Verify, device.** One Maestro flow per lane, with screenshots.
**Verify, perf.** Lane 4d has its own gate above. Phase 8 reruns phase 3's perf.

## Phase 5. Security extras (one agent)

**Owns.** `src/features/security/`, `src/features/activity/`.

- [ ] The screen guard (off in dev builds, forced on in release, with a test), the privacy cover, the activity log (cut first if late) and erase.

**Verify, unit.** The release config always guards. The log schema rejects amounts.
**Verify, device.** The recents view shows the cover. A release build's screenshot of History is black.
**Verify, perf.** None in this phase.

## Phase 6. Polish (one agent)

- [ ] Copy, accessibility labels, haptics, Sen's placement on every screen, dark mode check against the `SF-Dark-*` boards.
- [ ] Delete `src/features/stub/` once nothing imports it.

**Verify.** `snapshot -i` shows every designed label. Screenshots match the canvas boards side by side.

## Phase 7. Docs

- [ ] Rewrite README run steps, the "What this does not protect against" section, the decision summary and the perf numbers with how they were measured.
- [ ] Update ARCHITECTURE.md and DECISIONS.md wherever a fallback was taken during the build.

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

Sen motion (4d) is the most likely to overrun. It is isolated, and every moment is data, so moments can ship in priority order and the rest can slip without blocking release. A moment that isn't built falls back to a pose change.

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
| Emulator fingerprint isn't Class 3 for `'strong'` | 2c | Cleared in phase 0. The fingerprint is Class 3 |
| Emulator FPS too noisy to gate | 3 | Gate on your phone instead |
| Maestro can't reach the emulator from WSL | 0 | Run Maestro natively on Windows against the same flows |
| SVG `matrix` doesn't draw on device | 0 | RN `transform` array for the face slide |
| Fabric SIGSEGV in `MountingCoordinator::pullTransaction` on the JS thread, seen once on the first dev-build launch | All | Not reproduced in 8 launches, including the same bundle-URL swap. If it recurs, pull the tombstone and check Unistyles' and Reanimated's commit hooks |
| Reveal commit too slow on a slow phone (R3) | 3 | One animated view per amount, or mount digits for the first 12 rows first |
| Row insert jumps with keep-scroll-position on (R2) | 3 | Turn it off, or insert only when at the top |
| Android pull gesture fights the list (R1) | 4e | Keep `RefreshControl` |
| More than about 12 SVG nodes change per frame in Unlock | 4d | Measure. Move a channel to a View, or stagger the crossfades |
| The board's 900 ms row slide-in is long for UI motion | 3 | Kept as designed. The owner can shorten it later |
