# Sen architecture decisions

The technical decisions behind Sen, decided by the owner on 2026-10-15. Each record names the alternatives that were compared, why the choice won, what it costs, and the fallback if it fails in practice.

Every option was rated on the same five criteria.
- **Dev speed.** How fast agents can build and check it in about 3 days.
- **Scale.** How it behaves at 10,000 transactions.
- **Reviewer signal.** What a senior React Native reviewer reads into it.
- **Risk.** Build and runtime risk.
- **Security fit.** How well it fits the threat model in [ARCHITECTURE.md](ARCHITECTURE.md).

Versions and APIs were checked against npm, release notes and package source. Timings come from a SQLite benchmark on the desktop. They compare options, not phone latencies.

## Summary

| # | Decision | Chosen |
| --- | --- | --- |
| D1 | Storage engine | expo-sqlite with SQLCipher. MMKV for preferences only |
| D2 | Source of truth | The local database. The mock bank syncs into it with a cursor. TanStack Query reads SQL |
| D3 | Reading 10k rows | Keyset pages plus plain SQL sums |
| D4 | Search | `LIKE` on a normalised column |
| D5 | Seed data | Seeded generator, reviewer toggle for 20, 1k and 10k rows |
| D6 | Masking | Masked queries never select amounts. A revealed-only amounts map feeds the rows |
| D7 | List | FlashList v2, pinned to 2.3.3 |
| D8 | Styling | Unistyles 3 with typed tokens |
| D9 | Navigation | Every sheet and the add flow are routes inside `Stack.Protected` |
| D10 | Rendering Sen | react-native-svg with Reanimated, plus a MotionDirector reducer |
| D11 | React Compiler | On |
| D12 | Client state | Zustand wrapping the pure session reducer |
| D13 | Folder structure | `src/` with the brief's layers, kebab-case, enforced by ESLint |
| D14 | Security scope | Ten controls built, the rest stated honestly in the README |
| D15 | Errors | Tagged unions, thrown only at the TanStack seam |
| D16 | Tests | Pure table tests plus screen tests through ports, real SQL in Jest |
| D17 | Device loop | Windows emulator bridged to WSL |
| D18 | Device driver | Maestro plus raw adb. No biometric bypass |
| D19 | Inner loop | `npm run check` plus a dev-only states gallery. No Expo web |
| D20 | Performance proof | Jest benches in CI, Flashlight at milestones |
| D21 | Git and CI | `main` only, a pre-commit hook and GitHub Actions |
| D22 | Build order | Serial scaffold and contracts, then parallel lanes |
| D23 | Sen's motion model | Named channels, moments as data compiled to Reanimated |
| D24 | Motion levels | A live policy hook. Calm and Off compiled from the data |
| D25 | Animated components | Shared primitives, shared values for anything Jest must prove, CSS transitions for simple presses |
| D26 | Motion verification | The industry pattern: Jest values at chosen times, Maestro flows and settled screenshots, a release-build check on the phone |
| D27 | Showing amounts | Session state. Shown until hidden or until the app locks. Every unlock and cold start lands masked. Showing asks for biometrics |
| D29 | Copy reference | A local Expo module that marks the clip sensitive |
| D30 | Screen guard and backups | FLAG_SECURE app-wide in release, a JS privacy cover on iOS, backup and device transfer excluded |
| D30 | Adding a transaction | A floating Add key on History, no bar |
| D31 | Pull to refresh | A custom pan with Sen in the gap. `RefreshControl` is the fallback |
| D32 | Release build size | R8 minify and resource shrinking through expo-build-properties |

---

## D1. Storage engine: expo-sqlite with SQLCipher

**Compared.**
- MMKV with encrypted JSON records (the earlier plan).
- expo-sqlite with SQLCipher.
- op-sqlite.
- A reactive store (TinyBase, Legend State).

**Why.**
- **Bundled.** expo-sqlite comes with SDK 57, and encryption is one config flag (`useSQLCipher`).
- **Scales with the page.** It is the only option whose parsing cost follows the visible page, not the whole dataset. MMKV would decrypt and parse all 10k rows at unlock.
- **One encrypted file.** Bank rows, added rows and the activity log all live in it, so the separate MMKV vault goes away.

**Preferences.** MMKV stays for preferences only. Its synchronous read applies the theme before first paint, and Unistyles already brings its Nitro dependency.

**Cost.** About half a day of schema, migration and test-adapter work.

**Spike.** Passed on 2026-10-16. A WSL build on the API 36 emulator reports `cipher_version` 4.7.0 community. The database file starts with random bytes, and plain SQLite refuses it with "file is not a database".

## D2. Source of truth: the local database

**Compared.**
- A read-through cache with nothing on disk (the earlier plan).
- The database as truth, read through TanStack Query.
- The database as truth, read through live queries.

**Why.**
- **Local first.** The database is the truth. The mock bank feeds it pages through a `seq` cursor, with an idempotent upsert, so an interrupted sync recovers cleanly.
- **One cache to clear.** TanStack Query keeps a single cache, which is emptied on lock along with closing the database.
- **One writer.** The one write path invalidates queries after commit. That is simpler to test than a change listener.

**Cost.** Bank data now sits on disk, encrypted. The README says "cached encrypted, destroyed on sign-out" instead of "never on disk".

## D3. Reading 10k rows: keyset pages and SQL sums

**Compared.**
- Load everything and group in JS.
- Keyset pages with plain SQL sums.
- A window function for day nets.
- Precomputed total tables.

**Why.**
- **Fast enough.** A page, a month sum and a week of day nets each take about 0.1 ms on desktop.
- **Loses on both ends.** The window function was about 200 times slower. Precomputed totals add drift bugs for no gain.
- **Local days.** Days are stored in Malaysia time, so day groups match what the user sees.

## D4. Search: `LIKE` on a normalised column

**Compared.**
- `LIKE`.
- An FTS5 full-text index.
- A filter in JS memory.

**Why.**
- **Same speed.** Both SQL options take about 0.6 ms at 10k rows.
- **Mid-word matches.** `LIKE` finds "entral" in "KL Sentral". FTS5 only matches word prefixes.
- **No full load.** A JS filter would need every row in memory.

## D5. Seed data: a seeded generator

**Compared.**
- Static JSON files.
- A seeded generator in the mock bank.
- Faker.

**Why.**
- **Deterministic.** Tests and screenshots are stable.
- **Malaysian.** Merchants, salary days and DuitNow transfers are realistic.
- **Matches the boards.** The first 20 rows are the design-board rows.
- **No bundle bloat.** A 10k JSON file would add 1.2 MB.

The default is 1k rows. Reviewers can switch between 20, 1k and 10k in Settings.

## D6. Masking: amounts never leave the database while masked

**Compared.**
- Null the amount in a mapper (the earlier plan).
- Masked queries with no amount column.
- No amount column, plus a revealed-only amounts map.
- Hiding digits with opacity.

**Why.**
- **No amount to leak.** While masked, no amount exists in JS. That is a sharp claim backed by a test.
- **Stable list data.** The list's data never changes on reveal. A separate query fills an id-to-amount map, which is deleted on re-mask.
- **Opacity rejected.** Hiding digits with opacity leaves them in the screen reader tree.

## D7. List: FlashList v2, pinned to 2.3.3

**Compared.**
- SectionList (the earlier plan).
- FlashList at the bundled 2.0.2.
- FlashList at 2.3.3.
- Legend List.

**Why.**
- **Built for 10k rows.** FlashList recycles cells, which is what a reviewer expects at this size.
- **Version.** 2.3.3 includes the sticky-header and Android crash fixes that 2.0.2 lacks. It is pure JS, so the override carries no native risk.
- **SectionList rejected.** Its headers don't stick on Android by default.

**Fallback.** Legend List's SectionList drop-in, if the sticky headers misbehave on RN 0.86.

## D8. Styling: Unistyles 3

**Compared.**
- Uniwind with Tailwind classes (the earlier plan).
- StyleSheet with a typed theme.
- Unistyles 3.

**Why.**
- **Typos caught early.** Typed tokens let `tsc` catch them. Tailwind class typos only show on the device.
- **No re-render on theme change.** Theme switches don't re-render the list.
- **Variants.** They map onto Key, Tag and Stamp.

The Bricolage condensed fonts come as static files from upstream, embedded with the expo-font plugin.

**Spike.** Passed on 2026-10-16. On the emulator, with Reanimated running and the compiler on, three theme switches changed the canvas from `#F6F2E9` to `#121315` while a themed component rendered once.

## D9. Navigation: sheets and the add flow are protected routes

**Compared.**
- Routes inside `Stack.Protected`.
- Component modals.
- `@expo/ui` native controls everywhere.

**Why.**
- **Lock closes everything.** Locking removes protected routes, so every sheet and the add flow close with no extra code. Component modals would survive the lock.
- **Brand controls.** Native controls clash with the brand, so they are used only for the date picker.

## D10. Rendering Sen: react-native-svg with Reanimated

**Compared.**
- react-native-svg with Reanimated.
- Skia.
- Rive or Lottie.

**Why.**
- **Agents can build it.** The rig is code that agents can write and diff. Skia adds a new drawing API for one character. Agents can't author Rive or Lottie files, and Lottie isn't meant for UI state.
- **One Sen at a time.** A MotionDirector reducer enforces the rule that only one Sen animates.

The implementation is D23 to D26 and ARCHITECTURE.md › Motion.

## D11. React Compiler: on

**Compared.**
- On, the SDK 57 default.
- Off.

**Why.** It removes a whole class of memo mistakes agents make.

**House rules.**
- Shared values use `.get()` and `.set()`.
- Destructure functions from hooks.
- Keep an explicit `memo` on list rows.

## D12. Client state: Zustand wrapping the session reducer

**Compared.**
- A reducer with context (the earlier plan).
- Zustand.
- XState.
- Jotai.

**Why.**
- **Same reducer.** It stays pure and exhaustive.
- **Latest state outside React.** The lock timer and the app-background listener can read it without stale copies.
- **Narrow re-renders.** Selectors stop session changes from re-rendering rows.
- **Rejected options.** XState costs about half a day for five states. Jotai spreads one machine across atoms.

## D13. Folder structure: `src/` with the brief's layers

**Compared.**
- Root-level folders with mixed-case names (the earlier plan).
- Expo's default layout.
- A hybrid.

**Why.**
- **Both conventions.** The hybrid keeps the brief's `models`, `services`, `features` and `components` layers inside Expo's `src/` with the `@/*` alias and kebab-case files.
- **Enforced by lint.** The ESLint plugin that ships with `eslint-config-expo` enforces the layer rules, cycles and the `console` ban, so it adds no packages.

## D14. Security scope

**Compared.** Twelve controls, ranked by reviewer impact against cost.

**Built.**
1. Biometric unlock with every error mapped, plus the route guard.
2. Masking and the biometric show toggle (D27).
3. zod at every boundary.
4. Step-up on add and delete.
5. Encryption at rest.
6. Screen protection, in release builds only.
7. Idle lock and re-lock after leaving.
8. The lint-enforced logging rule.
9. The description sanitiser.
10. The custom keypad.

**Cut first if late.** The activity log.

**Not built.** A biometric-bound key. It loses the passcode fallback on Android and wipes data when a fingerprint is enrolled. The README explains this instead.

**Why.** An honest "what this does not protect against" section earns more trust than half-built crypto. The review also corrected four overstated claims in ARCHITECTURE.md.

## D15. Errors: tagged unions

**Compared.**
- Thrown `Error` subclasses.
- `Result` types everywhere.
- Tagged unions thrown only at the TanStack seam.

**Why.**
- **Typed errors.** Every error kind maps to a designed state, and `tsc` fails when a new kind is unhandled.
- **No `Result` everywhere.** It fights TanStack Query's rejected promises.
- **No raw messages.** Error screens never show raw messages.

## D16. Tests: pure tables plus screen tests through ports

**Compared.**
- Pure table tests with ports and fakes.
- Mocking every native module.
- A global coverage gate.

**Why.**
- **Fast and honest.** Fakes behind small ports keep tests fast without drifting from real behaviour.
- **Real SQL in Jest.** A `node:sqlite` adapter runs real queries with no emulator.
- **No coverage gate.** A global gate makes agents write filler tests.

**Spike.** `renderRouter` works under RNTL 14 on 2026-10-16. Await it and assert on what the screen shows. Its pathname helpers are lost, because RNTL 14's `render` returns a promise and the helpers are attached to it. It also turns on fake timers.

## D17. Device loop: Windows emulator bridged to WSL

**Compared.**
- An emulator on Windows.
- An emulator inside WSL.
- The owner's phone.
- EAS Simulator in the cloud.

**Why.**
- **Ready now.** The Windows emulator is already installed, uses the GPU, and agents can boot it themselves.
- **WSL emulator rejected.** It needs sudo and renders in software.
- **The phone stays for proof.** It records the final performance numbers and the demo video.
- **EAS Simulator held back.** It has limited access and costs money, so it is only an optional iOS look at the end.

**Setup.** One adb server for WSL and Windows, and the emulator console token copied into WSL.

## D18. Device driver: Maestro plus raw adb

**Compared.**
- agent-device.
- Maestro.
- Raw adb only.
- Detox.
- argent.

**Why.**
- **The common choice.** Maestro is Expo's documented device-testing path, and most large open-source RN apps surveyed use it: Bluesky, React Navigation, Ignite, Reanimated Carousel and Mattermost.
- **What it gives agents.** Flows, `waitForAnimationToEnd`, screenshot baselines and screen recording in one tool.
- **Rejected options.** agent-device is newer and less known, and its contact-sheet command is macOS-only. Detox needs a test build and native setup. argent isn't proven on Linux.
- **Raw adb.** It covers fingerprint taps, deep links and logs.
- **Real prompt.** Agents use the real biometric prompt. A bypass is the first thing a security reviewer looks for.
- **Screen guard.** It is off in dev builds and forced on in release, so screenshots aren't black.

**Note.** This replaces the earlier "no Maestro" rule. The flows in `.maestro/` are how agents verify their work. They are not a shipped E2E suite, and the README says so.

## D19. Inner loop: `npm run check` plus a states gallery

**Compared.**
- Jest, tsc and lint.
- Adding Expo web screenshots.
- Adding a dev-only states gallery.

**Why.**
- **States gallery.** One deep link renders any screen state from fixtures, and RNTL tests share the same fixtures.
- **No Expo web.** It needs web fallbacks for three security modules, and its layouts differ from native.

## D20. Performance proof: Jest benches and Flashlight

**Compared.**
- Flashlight.
- React Native DevTools.
- Perfetto.
- In-app marks with Jest benches.

**Why.**
- **Jest benches.** They gate every push in CI.
- **Flashlight.** It gives FPS and CPU on release builds at milestones.
- **DevTools.** Used only for diagnosis.
- **Perfetto.** Too slow to read.

**Budgets.**

| Metric | Budget |
| --- | --- |
| Scroll FPS on 10k rows | 55 or more |
| Unlock to first paint | 500 ms or less |
| Search at p95 | 100 ms or less |
| Each selector on Node | 16 ms or less |

## D21. Git and CI: `main` only, a hook and Actions

**Compared.**
- CI only.
- CI plus a pre-commit hook.
- Neither.

**Why.**
- **Every commit builds.** A zero-dependency hook (typecheck plus related tests) makes it a fact, not a hope.
- **Visible to reviewers.** CI is the check reviewers can see.

**Rules.**
- Short messages, no attribution lines.
- Parallel agents use local worktrees that fast-forward `main`, so history stays linear.

## D22. Build order: serial scaffold, then parallel lanes

**Compared.**
- One agent, strictly serial.
- A serial scaffold, then parallel lanes.
- One agent per screen.

**Why.**
- **Serial first.** The scaffold installs every dependency and stubs every route, so no lane touches shared files.
- **Then parallel.** Lanes own separate folders, which gives parallel speed without merge fights.
- **Vertical slices rejected.** One agent per screen would edit shared files constantly and bolt security on at the end.

The phases are in [PLAN.md](PLAN.md).

## D23. Sen's motion model: channels and moments as data

**Compared.**
- Hand-written worklets per moment.
- Moments as data compiled to Reanimated, with per-channel shared values.
- One clock per Sen sampling every track.
- Reanimated CSS animations.

**Why.**
- **Data is quicker to change.** Moments become data compiled into `withSequence`, `withTiming` and `withSpring`. Adding or tuning a moment means editing a table, not rewriting worklets.
- **Per channel.** Each SVG part only redraws when its own channel moves. One clock would wake every part on every frame.
- **No CSS in the rig.** CSS animations can't move SVG groups, ignore reduced motion, and can't be seen in Jest.
- **SVG transforms.** They use a worklet-computed `matrix`, because the native SVG components accept nothing else (V).
- **Tests.** They assert literal values from DESIGN.md, not the compiler's own output (D26).

**Cost.** A compiler of about 80 lines.

**Spike.** Passed on 2026-10-16. An `AnimatedG` driven by a worklet `matrix` slid the face sideways on the emulator, and the static clip `G` still cut it at the rim. RNSVG's `GProps` type leaves out `matrix`, so the one place that creates `AnimatedG` adds it to the props type.

## D24. Motion levels: a live policy, Calm compiled from data

**Compared.**
- Reanimated's `useReducedMotion()` with `ReduceMotion.System` everywhere (the earlier DESIGN rule).
- A live policy hook, with Calm and Off compiled from the moment data.

**Why.**
- **Live setting.** `useReducedMotion()` is read once at startup and never updates (V).
- **Calm.** `ReduceMotion.System` makes animations jump to their end, so DESIGN's 150 ms Calm crossfade has to come from the data.
- **Timers.** The lockout cool-down would end instantly under reduced motion, so it uses `ReduceMotion.Never`.
- **CSS transitions.** They ignore reduced motion, so components zero their duration from the same policy.

## D25. Animated components: shared primitives

**Compared.**
- Each lane building its own animations.
- Shared primitives in `src/motion/` and `src/components/`.

**Why.**
- **Shared values where Jest must prove it.** Motion that needs a test runs on shared values. That path works with fake timers. One shared value drove 20 rows with zero parent re-renders in the spike.
- **CSS for simple presses.** Key presses and the segmented pill use CSS transitions. Jest checks their target style.
- **Key presses.** They use Gesture Handler's `Pressable`, because RN's `Pressable` can drop presses on Android's fast animation path (V).
- **Rows.** No row holds animation state, so recycling stays safe.

## D26. Motion verification: the industry pattern

**Compared.**
- Our first plan: a time-freezing motion lab, goldens of moments mid-animation, video frames diffed with ffmpeg, and canvas parity tests.
- What Reanimated's docs and 15 large open-source RN apps do, among them Expensify, Bluesky, Rainbow, Mattermost, React Navigation, FlashList and Reanimated itself.

**Why the conventional path.**
- **Mid-animation pixels.** No surveyed app pixel-tests frames mid-animation, freezes a timeline or gates animation FPS in CI. Those parts were niche, so they are dropped.
- **Jest.** The common ground is `setUpTests` with fake timers, and `toHaveAnimatedStyle` and `toHaveAnimatedProps` with literal values at chosen times. Motion maths goes in pure functions with literal expectations, as in Reanimated Carousel.
- **No self-agreeing oracle.** Tests copy their numbers from DESIGN.md once instead of comparing the compiler with its own sampler.
- **Device.** Maestro flows wait with `waitForAnimationToEnd`. Maestro `assertScreenshot` checks settled screens and poses against baselines the owner approves. This is the same baseline workflow FlashList and Chromatic use.
- **Motion feel and smoothness.** Judged by eye. Maestro records video for the owner, and the Perf Monitor runs on a release build on the phone. Flashlight over a Maestro flow is optional, as at Bluesky and Rainbow.

**Watch out.** Keep the emulator's animation scales on. Reanimated reads a zero transition scale as reduced motion, so every moment would jump to its end.

## D27. Showing amounts: session state, masked on every unlock and cold start

**Decision.** Whether amounts show is `amountsHidden` in the session store. It starts true, goes true again whenever the database closes, and is never saved. Showing asks for biometrics every time. Hiding never does. A reveal lasts until the user hides amounts or the app locks.

**Compared.**
- A timed reveal. One biometric check shows amounts for 30 s to 2 min, with a countdown ring, and background re-masks.
- One saved setting, `hideAmounts`, flipped from History or Settings. It survives lock and restart. (The first answer.)
- The saved setting, plus a reset to hidden on lock and on launch.
- Session state that resets with the session. (Chosen.)

**Why session state.**
- **The brief.** It asks for amounts masked by default and revealed with biometrics. A reviewer who relaunches the app must see masked. The saved setting failed this: a reveal outlasted lock and restart, so the app reopened showing money.
- **Familiar.** A reveal scoped to the session, re-hidden when the app locks, is the common banking pattern (inferred, not surveyed). A timer that re-hides amounts mid-read still fights the user, so there is none.
- **Cold start is masked by construction.** An in-memory flag starts true. A pref with a reset on launch needs a write that runs after the first frame, and any path that skips it (a crash, a new entry point) shows amounts.
- **One narrow reset.** The session's close path already clears the query cache and the toast on every lock and sign-out. The flag resets in the same `setState`, so idle, background, manual and sign-out locks are covered together.
- **No persisted sensitive-adjacent state.** MMKV keeps no amounts key. A `hideAmounts` left by an earlier build is never read.
- **Security kept.** Turning it off always asks for biometrics, and turning it on never does. The app still locks on idle and on return after the re-lock window. While hidden, no amount exists in JS. The lint rule moves with the value: outside `amounts.ts` and tests, an `amountsHidden` property may only be the literal `true`.

**What the user sees.** Unlock lands masked, Settings' Hide amounts switch reads On, and the month card's Sen starts masked. A lock unmounts History, so the next mount starts in the masked pose and Re-mask does not play on unlock. Re-mask still plays on "Hide amounts". Copy says "Stays shown until you hide it or Sen locks."

**History.**
- 2026-10-16. First answer: one saved setting, shown until hidden, surviving lock and restart. Reason: one value instead of a session state plus a preference, and no timer.
- 2026-10-17. Reopened by the owner. The brief says masked by default, and a reviewer relaunching must see masked. Changed to session state. The saved setting and its "survives lock" tests were removed.

## D29. Copy reference: a local module marks the clip sensitive

**Compared.**
- `expo-clipboard` 57.0.2. Its `setStringAsync` takes only `inputFormat`, so it can't mark a clip sensitive.
- React Native's own `Clipboard`. It is deprecated, and `setString` takes text only.
- A local Expo module, `modules/sen-clipboard`, with one function in Kotlin and Swift.

**Why the local module.**
- **The flag.** Android 13 and later show a clip marked `ClipDescription.EXTRA_IS_SENSITIVE` as dots in the system's copy preview. Only native code can set it. Below Android 13 the module sets the same key as a string, as Android's copy and paste guide does.
- **Standard.** Local modules are Expo's documented way to add a little native code, and autolinking finds `modules/` with no config.
- **iOS.** iOS has no sensitive flag. The module writes the item local only, so Universal Clipboard doesn't send it to other devices, and it expires after two minutes (inferred: not built on a Mac).

**Cost.** One native rebuild. A build without the module reports a failed copy and points at the reference, which is selectable, so nothing breaks.

## D30. Screen guard, privacy cover and backup rules

**Compared.**
- Guard only unlocked screens, or guard the whole app in release builds.
- On iOS, the native blur of `enableAppSwitcherProtectionAsync`, or the board's JS cover with Sen.
- For Android backups, `allowBackup: false` alone, or also `dataExtractionRules` and `fullBackupContent`.
- The rules through a repo config plugin, or an existing package.

**Chosen.**
- **Whole app in release.** `preventScreenCaptureAsync` runs from the root layout. It is retried on foreground after a native failure, and an Android Activity recreation re-engages it through unmount and remount, because a recreated Activity loses FLAG_SECURE. expo-screen-capture skips the native call while the key is already active, so a foreground event alone never re-applies a flag that succeeded. Guarding only unlocked screens leaves a gap when the lock state changes and gains nothing, since Lock shows no data. Dev builds stay open so agents can screenshot.
- **JS cover on iOS only.** The expo native blur starts on `willResignActive`, which also fires while the Face ID sheet is up, so it would blur every unlock. The cover skips `inactive` while `isAuthenticating()`, and always covers `background`. The secure canvas from the guard is the native layer under it (inferred to blank the switcher snapshot, unverified without a Mac). Android needs no JS cover: FLAG_SECURE blanks recents, and Android emits no `inactive`.
- **Backup rules.** The Android docs say that for apps targeting 12+, `allowBackup="false"` on some manufacturers' devices disables cloud backup but not device-to-device transfer, and that a missing `<device-transfer>` section means that mode copies everything (developer.android.com/identity/data/autobackup). So `plugins/with-no-backup.js` writes both rule files excluding every domain. Config plugins are the Expo route; `expo-build-properties` has no such option. `expo-secure-store` ships its own narrower rules, so its plugin runs with `configureAndroidBackup: false`.

**Watch out.** react-native-screens presents formSheet and fullScreenModal above the root view, so the root cover does not hide them. The delete sheet and the add flow show amounts, so each mounts its own `PrivacyCover`. The other sheets show no amounts. Changing the plugin needs `expo prebuild` and a native build.

## D30. Adding a transaction: a floating key, not a header key or a bar

**Compared** (the `SF-AddNav-Options` board).
- A. A floating Add key at the bottom right, no bar.
- B. A two-tab bar with Add in the middle.
- C. A thumb dock.
- The old header key.

**Why A, with the owner's change.**
- **Reach.** The most common write sits under the right thumb. Material, Copilot Money and Buddy float the key the same way.
- **Smallest change.** No route changes, and the header gets calmer. A bar needs a tabs route group, which the plan keeps with the coordinator, and Apple says tabs navigate rather than act.
- **The owner's change.** The key stays a loud 60 × 60 "+" at every scroll position, with no "Add" word. The board's grow and shrink on scroll is dropped. The label "Add a transaction" is the name TalkBack and the flows use.
- **With the toast.** Material lifts a FAB above a snackbar, so the key rises with the undo toast on the toast's own timing instead of hiding under it. A toast is one line plus a bar, so the lift is a fixed 92 pt. A two-line detail would still clear it by about 6 pt (inferred from the font sizes).

## D31. Pull to refresh: a custom pan, with the platform control as the fallback

**Compared.**
- FlashList's `refreshing`, which is Android's `RefreshControl`. It is conventional and costs nothing, but its spinner cannot hold Sen, and the board's stretch out of the gap is impossible.
- A `Gesture.Pan` beside the list, with the gap and Sen drawn by us.

**Why the pan.** The board's pull, spin and landing are the screen's signature moment, and the pan gives direct manipulation, which DESIGN allows. The list's scroller is Gesture Handler's `ScrollView` with `simultaneousHandlers`, because a plain React Native scroller cancels a parent pan once it takes the touch. The pan pulls only while the list is at offset 0.

**Risk.** Spike R1 (the pan beside FlashList on the phone, five normal scrolls still scroll) has not run. The unit tests prove the maths, the thresholds and the state changes through Gesture Handler's test driver, not the touch arbitration. If the spike fails, revert the lane's pull commit and keep `RefreshControl`.
## D32. Release build: R8 minify and resource shrinking through `expo-build-properties`

**Compared.**
- Leave Expo's defaults (no minify, no shrink).
- Turn both on through `expo-build-properties` in `app.config.ts`.
- Edit `android/app/build.gradle` by hand.

**Why the plugin.**
- **Conventional.** It is the documented Expo route and survives `expo prebuild`, which regenerates `android/` (git-ignored). A hand edit would be lost.
- **Smaller APK.** The reviewer APK is a release build. Shrinking drops unused code and resources (size gain not yet measured).
- **Risk.** R8 can strip classes that native code reaches by reflection. A review of the dependencies found the keep rules in place (read from source, not yet run under R8). Reanimated, Worklets, react-native-svg and expo-modules-core ship `consumerProguardFiles`. The MMKV and Unistyles Nitro specs carry `@DoNotStrip` and `@Keep`. expo-sqlite's JNI code uses `DoNotStrip`. expo-font registers its `R.font` references, so resource shrinking keeps them. The release smoke of unlock, add, delete and lock stays the gate before the build is trusted. Keep the R8 mapping file (`mapping.txt`) with the reviewer APK, so a stack trace from it can be read. If a module breaks, add a keep rule through the plugin's `extraProguardRules`, not by turning minify off.
