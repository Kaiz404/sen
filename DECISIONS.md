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
| D28 | A phone with no screen lock | Sen refuses to run and points to the lock-screen settings. No Sen PIN |
| D29 | Copy reference | A local Expo module that marks the clip sensitive |
| D30 | Screen guard and backups | FLAG_SECURE app-wide in release, a JS privacy cover on iOS, backup and device transfer excluded |
| D31 | Security activity log and erase | A capped table in the vault. Failed unlocks wait in memory. Erase deletes only the rows the user added, behind step-up |
| D32 | Release build size | R8 minify and resource shrinking through expo-build-properties |
| D33 | Adding a transaction | A floating Add key on History, no bar |
| D34 | Catching up | History finishes only a cut-short first sync, so ordinary unlocks send nothing |
| D35 | Pull to refresh | A custom pan with Sen in the gap. `RefreshControl` is the fallback |
| D38 | Bottom sheets | Keep the expo-router native formSheet and tune it: 30 corners, iOS grabber, a drawn handle on Android |
| D37 | Date picker | The system calendar from `@react-native-community/datetimepicker`, not a drawer of 91 rows |

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

**What the user sees.** Unlock lands masked, Settings' Hide amounts switch reads On, and the month card's Sen starts masked. A lock unmounts History, so the next mount starts in the masked pose and Re-mask does not play on unlock. Re-mask still plays on "Hide amounts".

**History.**
- 2026-10-16. First answer: one saved setting, shown until hidden, surviving lock and restart. Reason: one value instead of a session state plus a preference, and no timer.
- 2026-10-17. Reopened by the owner. The brief says masked by default, and a reviewer relaunching must see masked. Changed to session state. The saved setting and its "survives lock" tests were removed.
- 2026-10-17. The owner removed the helper copy "Stays shown until you hide it or Sen locks." from the month card and the Detail receipt, because the behaviour is implied. The rule is unchanged.

## D28. A phone with no screen lock: refuse and point to settings

**Compared.**
- A Sen PIN as a fallback, only for phones with no screen lock.
- A Sen PIN for everyone, in place of the device passcode.
- Refuse to run until the phone has a screen lock, and open the lock-screen settings in one tap.

**Why refuse.**
- **Conventional.** Banking apps (Malaysian banks, Revolut) refuse to run on a phone with no device lock. The sign-in decision is "device biometrics with passcode fallback", and a phone with no lock has no fallback to use.
- **Hardware-enforced attempts.** The OS and the secure hardware count wrong tries and impose the lockout. A Sen PIN would be checked in JS, so the attempt limit and its storage would be ours to get right, and a copied app data folder could try PINs without limit.
- **Less to build.** A PIN means setup, change, forgot and its own lockout screens. The brief asks for device biometrics.

**What it does.**
- **Detection.** `getEnrolledLevelAsync` returns `NONE`. `detectBiometric` maps it to the enrolled level `none`.
- **Lock and Welcome.** Both show "Set a screen lock to use Sen" with one key, "Open lock-screen settings". Android sends the `android.app.action.SET_NEW_PASSWORD` intent. iOS opens Sen's page in Settings.
- **Return.** The app re-reads the level each time it becomes active, so the message clears once a lock exists. A failed read keeps the last level, or counts as a passcode on launch, so a flaky read never says "no lock".
- **Lockouts.** The OS owns them (D40), so Lock has no lockout or blocked view.

**Cost.** A reviewer's emulator needs a PIN, as the API 36 AVD already has.

**Consequence (D40).** "No Sen PIN" means the screen lock is the only non-biometric way in. The first build leaned on the system sheet's built-in fallback, which crashes on Android 9 and 10 and left every "Use device passcode" key opening the fingerprint sheet again. D40 picks the route per phone and removes the second key.

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

**Finding 2026-10-17: sheet windows.** On react-native-screens 4.26.2 a formSheet is a `ScreenStackFragment` (`ScreenStack.kt:60-64`) that builds the sheet as a `CoordinatorLayout` with `BottomSheetBehavior` inside the activity's own window (`ScreenStackFragment.kt:186-238`). Only `ScreenModalFragment.kt:199` creates a `BottomSheetDialog`, and nothing creates that fragment. So the sheets share the activity window and inherit its FLAG_SECURE, and no patch is needed. To be verified by a release-APK screenshot with the Delete sheet open. `scripts/check-release-guard.sh` fails if `ScreenStack.kt` stops mapping FORM_SHEET to `ScreenStackFragment`, because the sheets may then be a separate window and the FLAG_SECURE question must be rechecked.

## D31. Security activity log and erase

**Compared.**
- **Where the log lives.** The `activity_log` table in the SQLCipher file, a separate MMKV list, or nothing persisted.
- **Failed unlocks.** The vault is closed when a finger fails, and opening it to log the miss would open the file without the check.
- **What erase means.** Delete only the rows added on the phone (the board's plan), or wipe the vault, key and prefs. The first cut wiped everything. The owner chose the board's meaning on 2026-10-17.

**Chosen.**
- **The vault.** The log is one more table in the encrypted file, capped at 50 rows by a trigger (retention is the cap). Sign-out destroys it with the file. The sample rows come from the bank, so a log kept outside the file would outlive the data it describes.
- **Held events.** A failed unlock or a lockout is kept in memory (at most 50) and written with its own time at the next successful unlock. The app never opens the vault without the check. A process killed before the next unlock loses the held events, which is the price of that rule.
- **No amounts, by shape.** `ActivityEventSchema` is a strict union per code. No code has a number a transaction could fill, and an extra field is refused when the row is written and when it is read. Add, delete and undo carry the description, as the board shows, and never the amount.
- **Errors never block.** A failed log write is counted by the logger and never reaches the add, delete or unlock that caused it.
- **Erase deletes what the user added.** "Erase transactions I added" asks for the check (`erase` step-up), then deletes every row with source `manual` and the undo copy in one transaction (`eraseManual`). Bank rows, the vault, the key and the prefs stay, so Sign out (which wipes the vault) and Erase are no longer one tap apart with the same result. The sheet says how many rows go and that it can't be undone. A failed delete rolls back and the sheet says nothing was changed, with Try again. With no added rows the Settings row is off and the sheet says there is nothing to erase. A phone whose check is off, unavailable or unknown gets "Open device settings", since a retry would fail again.
- **Logged.** An erase records `tx.erased` with the row count, never what the rows held. Sign-out still leaves no entry, because it destroys the log with the file.
- **Descriptions outlive their rows.** Add, delete and undo events carry the description. Deleting or erasing a row does not remove those events, so a description stays in the log until it ages out of the 50 events or the log is cleared.
- **Logged settings.** Only the changes that leave the phone open longer: a longer idle lock or a longer leave window. Hiding amounts, a shorter window and cosmetic settings are not security events.

**Cost.** One small module of SQL, a recorder with a hold list, and a few `record` calls at the places that already know the event.

## D32. Release build: R8 minify and resource shrinking through `expo-build-properties`

**Compared.**
- Leave Expo's defaults (no minify, no shrink).
- Turn both on through `expo-build-properties` in `app.config.ts`.
- Edit `android/app/build.gradle` by hand.

**Why the plugin.**
- **Conventional.** It is the documented Expo route and survives `expo prebuild`, which regenerates `android/` (git-ignored). A hand edit would be lost.
- **Smaller APK.** The reviewer APK is a release build. Shrinking drops unused code and resources (size gain not yet measured).
- **Risk.** R8 can strip classes that native code reaches by reflection. A review of the dependencies found the keep rules in place (read from source, not yet run under R8). Reanimated, Worklets, react-native-svg and expo-modules-core ship `consumerProguardFiles`. The MMKV and Unistyles Nitro specs carry `@DoNotStrip` and `@Keep`. expo-sqlite's JNI code uses `DoNotStrip`. expo-font registers its `R.font` references, so resource shrinking keeps them. The release smoke of unlock, add, delete and lock stays the gate before the build is trusted. Keep the R8 mapping file (`mapping.txt`) with the reviewer APK, so a stack trace from it can be read. If a module breaks, add a keep rule through the plugin's `extraProguardRules`, not by turning minify off.

## D33. Adding a transaction: a floating key, not a header key or a bar

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

## D34. History catches up only a cut-short first sync

**Compared.**
- Catch up on every History mount that has a cursor.
- Catch up when the cursor is above 0 and the feed's end was never reached.
- Add a `first_sync_done` column to `sync_state`.

**Chosen.** The second, with the end of the feed kept as a `meta` key (`bank.feedEnd`).
- **Why not every mount.** Every unlock then sent a bank request. That used up a reviewer's armed one-shot fault early, added a `newOnRefresh` row with no slide-in, and held Settings on "Syncing…". The gap the audit named is an interrupted first sync that never resumes, and only that needs a request.
- **Why a `meta` key.** The sync commits the key in the same transaction as the last page and its cursor, so the flag and the data cannot disagree. `resetBankRows` deletes it with the rows. A column would need a migration for one boolean.
- **Existing installs.** A database that finished before this change has a cursor and no key. It catches up once, the feed's last page sets the key, and later unlocks send nothing.

**Cost.** A feed that grows after the last page leaves the key set, so only a pull fetches the new rows, as before.

## D35. Pull to refresh: a custom pan, with the platform control as the fallback

**Compared.**
- FlashList's `refreshing`, which is Android's `RefreshControl`. It is conventional and costs nothing, but its spinner cannot hold Sen, and the board's stretch out of the gap is impossible.
- A `Gesture.Pan` beside the list, with the gap and Sen drawn by us.

**Why the pan.** The board's pull, spin and landing are the screen's signature moment, and the pan gives direct manipulation, which DESIGN allows. The list's scroller is Gesture Handler's `ScrollView` with `simultaneousHandlers`, because a plain React Native scroller cancels a parent pan once it takes the touch. The pan pulls only while the list is at offset 0.

**Risk.** Spike R1 (the pan beside FlashList on the phone, five normal scrolls still scroll) has not run. The unit tests prove the maths, the thresholds and the state changes through Gesture Handler's test driver, not the touch arbitration. If the spike fails, revert the lane's pull commit and keep `RefreshControl`.

## D36. The unlock prompt times out at 60 s, and says so

**Compared.**
- No timeout. A prompt the OS never answers, such as one the app was backgrounded under, leaves Lock on "Checking it's you" with every key disabled.
- A longer timeout, such as 2 or 5 minutes.
- A timeout on time in the background only.
- 60 s of foreground time, the clock paused while the app is not `active`.

**Chosen.** The last, kept from before, with one change: a timeout now ends as its own reason, `timedOut`, where it used to read as a user cancel. A cancel is silent. A screen that went quiet after 60 s left the user wondering what happened. Now Lock says the check timed out and keeps the unlock key ready. Add, Delete, Erase and Clear activity each say so in their own copy, and Show amounts stays hidden with a toast.

**Why 60 s, and not longer or resettable.**
- The system dialog reports nothing to the app, not keystrokes and not progress. Sen cannot tell a user typing a PIN from a dialog nobody touches, so it cannot restart the clock on activity.
- A longer fixed timeout only delays the stuck state for everyone who is stuck. A minute is long for a fingerprint or a PIN.
- The owner confirmed 60 s.

**Revision (D40).** The 60 s is the clock of the sensor alone, which only Android 9 and 10 ask. Any sheet that can end in the screen lock waits 5 minutes (`CREDENTIAL_TIMEOUT_MS`): the combined sheet and the screen lock itself. The user may switch to a slow pattern or password inside the combined sheet, and Android makes them wait 30 s after five wrong tries, so 60 s would cancel a pattern mid-entry. On Android 11 and later the sheet is drawn over Sen, so the app stays `active` and the clock would run. On Android 9 and 10 the system's own screen takes the app out of `active`, so the clock pauses as it does for any absence (inferred, not seen on a device).

**Not a failed try.** `timedOut` is not `mismatch` or `lockout`. It adds no "Too many tries" count, logs no `auth.failed`, never raises the blocked steer and never counts as a store fault, the same as a cancel. A store failure stays as it was, and a cancel leaves the view alone.

## D38. Bottom sheets: keep the native formSheet and polish it

**Found.** The sheets (Delete, Erase, Privacy, Sign out, Reset demo) already are native: expo-router `formSheet` routes (D9) on react-native-screens, a UISheetPresentationController on iOS and a `BottomSheetBehavior` in the activity window on Android (so they inherit FLAG_SECURE, see the D30 finding). The ask was a native look in the app's style.

**Compared.**
- **(a) `@expo/ui` BottomSheet.** First party, and `RNHostView` can host our views. But it is a component, not a route, so keeping D9's lock-closes-everything needs a wrapper route per sheet. The 57.0.23 and 57.0.24 changelogs still fix `RNHostView` touch and reanimated crashes, there is no corner-radius prop on Android, and it needs a Jest mock and a rebuild.
- **(b) `@lodev09/react-native-true-sheet` 3.11.** In-window on Android, so it inherits FLAG_SECURE. Also a component (wrapper route), third-party, and a rebuild.
- **(c) Keep the formSheet and tune it.** Chosen.

**Chosen (c).** It is Expo's documented route, already a route under `Stack.Protected`, hardware back pops it, the labels reach Maestro as before, and it adds no dependency. The shared `sheetOptions` in `src/app/_layout.tsx` set 30 corners on both platforms (`sheetCornerRadius`, read by iOS and by Android in `ScreenStackFragment.kt:415-427`), an Android `sheetElevation`, the native grabber on iOS, and a `contentStyle` surface from the theme's `canvas` token. Android never reads `sheetGrabberVisible`, so `SheetSurface` (`src/components/sheet-surface.tsx`) draws a decorative Material 3 handle (32 x 4 dp, 22 dp top area, `inkMuted`, hidden from accessibility) on Android only. It also replaces the surface style each view repeated.

**Watch out.** `SheetSurface` paints the `canvas` surface itself because the gallery and tests render the views outside the route. The board draws the sheet on `paper` with `canvas` rows, while the app has `canvas` sheets with `paper` rows, and this change keeps the app's version. Research and the constraint grid: `~/sen-pickup/p5/sheets-research.md`.

## D37. The date is picked in the system calendar

**Compared.**
- A custom bottom drawer listing the 91 allowed days (kept until now). It is fully on brand, but it shows no month grid, so a user cannot see which weekday a date falls on or jump a month.
- `@expo/ui`'s date picker. It would match the bottom-sheet lane's package, but it is the newer, less used surface (inferred), and it would tie this field to a package another lane is still evaluating. For a date-only field it offers nothing the community package lacks.
- A custom calendar grid drawn by us. It would take weeks to make accessible, localised and correct across month lengths, for no gain over a system control.
- `@react-native-community/datetimepicker`, installed with `npx expo install` (9.1.0). It is the long-standing standard, wraps the platform dialog, and has an imperative Android API.

**Chosen.** The last.
- **Android.** `DateTimePickerAndroid.open({ mode: 'date' })` opens the system calendar dialog. The default dialog is used, not `design: 'material'`, because Material 3 pickers need the app theme to inherit `Theme.Material3.DayNight` and the app's theme is AppCompat.
- **iOS.** `<DateTimePicker display="inline">` sits in the sheet the drawer used, with the same title and close key. A pick applies and closes. The accent is `loud` (ink in light, lemon in dark) so the selected digit stays readable; that is inferred until an iOS check.
- **The field.** The row of Today, Yesterday and Pick a date stays. Pick a date keeps its look and shows the chosen day, such as "Mon 5 Oct", once one is picked.
- **Rules kept.** `minimumDate` is the first allowed day at 00:00 and `maximumDate` is today at 23:59:59.999, so the calendar greys every day outside the add window. The result is checked again with `isInAddWindow` before it reaches the draft, so a date the dialog should refuse still cannot be saved. The default stays today. The add form picks a day only, never a time, so there is no time step.
- **Time zones.** A `DayKey` is a Malaysia day. A day crosses to the picker as the same year, month and day on the device clock, at noon, and comes back the same way.
- **Never stuck.** Dismissing the dialog changes nothing, so the old date and the whole draft stay. Leaving the page dismisses an open dialog, so it never floats over Lock. A second tap while it is open does nothing, and an answer or an error frees the field. Today is read when a date is chosen, so a dialog left open past midnight still refuses tomorrow.
- **Config.** `app.config.ts` holds hex copies of the dialog colours, because Expo loads it alone and cannot import `src/`. A jest test fails when they drift from `theme/colors.ts`, and `npm run check` runs `expo config --type public`.
- **Theme.** The package's config plugin sets the dialog's accent, text and window colours from the light and dark tokens. The dialog follows the phone's light or dark mode, not Sen's Theme setting, so a phone in dark mode with Sen set to Light shows a dark dialog. The plugin sets the text on the accent (header and selected day) too: ink on lemon in dark, cream on ink in light, all above 4.5:1 (a jest test computes it). This mismatch with Sen's Theme setting is known and stays; forcing the app's scheme is a separate decision.

**Cost.** A native rebuild, since the package adds a native module and a config plugin changes `colors.xml` and `styles.xml`. The look of the open dialog is the system's, so no gallery state shows it. The gallery shows the field with a picked date instead.

## D39. Pending rows post on a later refresh

**Problem.** Every row the bank sent as pending stayed pending, so Detail's Authorised › Pending › Posted timeline sat on "Posted: NEXT" for ever and the History PENDING tag never came off.

**Compared.**
- A timer on the phone that flips old pending rows to posted. It needs no bank change, but the phone invents bank state, and the row changes with no sync, so nothing in the data says it posted.
- Post every pending row on the next refresh. Simple, but the row that arrived on that same refresh posts at once, so a reviewer never sees a pending row on a pull.
- Leave it. The timeline's last step never completes.
- The bank reports it (chosen).

**Chosen.** The simulated bank is the source of truth, as in Plaid's transactions sync, where a response carries `added` and `modified` rows. A page now has `items` (new rows) and `modified`, a list of `{ id, settledAt }`.
- **Rule.** A pending row posts on the first refresh at least 2 minutes after it was authorised (`SETTLE_AFTER_MS` in `bank-api.ts`), and `settledAt` is `postedAt` plus 2 minutes, not the time of the request. It is a pure function of the row and the injected `now`, so tests need no sleep, a retry reports the same change, and a rerun is harmless. Two minutes is short enough for a demo, and long enough that a row a refresh just brought is still pending on that refresh and posts on a pull a little later.
- **Only a refresh reports postings.** A request past the end of the feed carries `modified`. Pages of the feed do not, so the first open still shows the board's Tealive, Grab and TNB as pending. They post on the first pull, because they are hours old.
- **Applied as an update.** `sync` runs `UPDATE tx SET status = 'posted', settled_at = ? WHERE id = ? AND source = 'bank' AND status = 'pending'` in the same transaction as the page and its cursor. A failed or interrupted sync posts nothing. An update never inserts, so a posting for a row the phone no longer holds (after a reset) adds nothing. Added rows, and rows already posted, are never touched, so a posted row keeps its first time.
- **Storage.** Migration v2 adds a nullable `settled_at` column with the same instant check as `posted_at`. Existing rows keep every value and read as never settled. A bank row that arrived posted has no `settled_at` and no timeline, as before.
- **Reads.** `settled_at` is selected by the masked and revealed reads. It is a time, so masking is unchanged: posting never touches `amount_minor`, and the masked cache still holds no amount.
- **Look.** Detail's timeline shows all three steps done for a posted row, Pending as "CLEARED" and Posted at its time. The History PENDING tag follows `status`, so it drops off on its own. Reset demo data restores the pending board.

**The bank's own state survives a restart.** The mock bank keeps a small state in an MMKV key beside the demo prefs (`bank.state`, outside the settings table): the instant its feed was generated (the anchor) and the `{ seq, postedAt }` of each row it minted, per dataset size. MMKV is the repo's store for demo state and already has a reset path, and the bank has no database handle. Without it, a restart left a minted row pending for ever and re-anchored the feed to the new day, which gave the board rows the wrong `settledAt`. `resetBank` writes the default, so Reset demo data and a dataset switch start a fresh feed. The posting is also clamped in SQL, `settled_at = max(?, posted_at)`, so a backwards clock never makes Posted earlier than Authorised. The upsert never turns a posted row back to pending.

**A newer file is not always unreadable.** Each migration step records `schema.minReader` in `meta`: the oldest app schema that can still read the file. v1 and v2 are 1, because v2 only adds a nullable column. On open, `migrate` throws `SchemaTooNewError` only when that number is above the app's version, not whenever `user_version` is. A newer file with no recorded number is still refused. A build that predates this check still resets a v2 file, which no code here can change.

**Cost.** The bank keeps the rows it minted so it can post them later, and sends every aged pending-origin row on each refresh. The phone ignores the ones already posted. For a demo that is a handful of ids.


## D40. One Unlock key, and Sen picks the route

**Problem.** Sen called `authenticateAsync` with a strong biometric and the device fallback for every check, which caused four faults.
- Every "Use device passcode" key called the same function, so it opened the fingerprint sheet again.
- On Android 9 and 10 (API 28 and 29) that pair is unsupported, and `PromptInfo.Builder.build()` throws outside expo's try, so unlock probably crashed there (minSdk is 24).
- Sen's own lockout card and its "N more tries" count were unreachable in practice: Android never reports a single miss, and with the screen lock allowed inside the sheet a lockout never reaches JS.
- A phone with only a weak biometric, or none, still opened a fingerprint sheet first.

**Compared.**
- **One key, keeping the combined sheet everywhere.** Least code, and it keeps the crash on API 28 and 29.
- **Two keys: Unlock (the sensor alone) and Use screen lock (the credential alone).** Built and tried first (the owner saw it), then **rejected**: it asked the user to choose up front, needed a lockout card, a blocked steer and a tries count that the OS does not give us, and on Android could not offer "Use screen lock" from a plain Cancel (expo maps the Cancel button and a dismissal both to `user_cancel`).
- **Patch `expo-local-authentication` with patch-package.** It forks a dependency that SDK upgrades overwrite.
- **A Sen password inside the app.** **Considered and rejected by the owner.** Device-credential checks are hardware-backed and throttled by the OS, where a password checked in JS would make the attempt limit ours to get right. Without a server there is no recovery for a forgotten one. It would be a second secret for the user to hold. It breaks D28, which already chose no app PIN.
- **Chosen: one key, and the app picks the route** from the phone and what is enrolled. The owner chose simplicity: no choice between biometrics and passcode on screen.

**Chosen.** `routeOf(os, api, level)` in `prompt.ts`, used by `authenticate()` for unlock and every step-up (through `check()`).

| Phone | Strong biometric enrolled | No strong biometric |
| --- | --- | --- |
| Android 11 and later | The combined sheet, `BIOMETRIC_STRONG \| DEVICE_CREDENTIAL`. Its own "Use PIN, pattern or password" button is there, and after five misses the OS moves to the screen lock | The screen lock alone, through `modules/sen-auth` |
| Android 9 and 10 | The sensor alone. A lockout, or an unavailable sensor, hands over to the screen lock in the same call | The screen lock alone, through `sen-auth` |
| Android 7 and 8 | The combined sheet | The screen lock alone, through `sen-auth` |
| iOS | `deviceOwnerAuthentication`: Face ID or Touch ID, then the passcode in one sheet | The same call, which goes straight to the passcode |

- **Why 28 and 29 only.** androidx.biometric 1.2.0-alpha04 (the version expo-local-authentication 57.0.3 builds against) decides it in `AuthenticatorUtils.isSupportedCombination`, read from its bytecode: `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` is supported when `SDK_INT < 28 || SDK_INT > 29`, and `DEVICE_CREDENTIAL` alone from API 30. API 24 to 27 take the combined sheet. Below 30, `sen-auth` uses the keyguard activity because `DEVICE_CREDENTIAL` alone is unsupported there.
- **One options object, tested by behaviour.** A test drives every route on every API level 24 to 36 and fails if `strong` reaches expo without `disableDeviceFallback: true` on 28 or 29. A second fails if any file but `prompt.ts` calls `authenticateAsync`.
- **What was deleted.** The mismatch, lockout, blocked, off and weak Lock views, their copy, gallery states and Maestro flows, the "Simulate lockout" reviewer control and the dev override values `fail` and `lockout`. The OS owns misses and lockouts now. What remains reachable: the API 28 and 29 hand-over (logged as `auth.failed` with reason `lockout`), a cancel, `timedOut` (D36), `noLock` (D28) and errors. The Sen moments for a miss and a lockout stay in the library and no auth path plays them.
- **Hand-over and a lock.** If a lock arrived while the first prompt was up, the hand-over is skipped and the check ends as a cancel, so no second prompt opens on a locked session.
- **Re-lock window.** Sen's own prompts can take it to the background (the Android 9 and 10 screen-lock activity, possibly the credential UI on 11 and later). While a prompt is up that is not a trip away: a pass keeps the session, and any other end applies the away check for the time spent away.
- **No screen lock.** `sen-auth` answers `passcode_not_set`, which maps to the `noLock` failure and D28's view.
- **Clock.** 60 s for the sensor alone, 5 minutes for the combined sheet and the screen lock (see the D36 revision).
- **Naming.** The key names a sensor only when a strong biometric is enrolled, and says "biometrics" when Android cannot say which. Otherwise it says "Unlock". Android's credential is "screen lock" in copy, because it may be a PIN, pattern or password, and iOS says "passcode".

**Cost.** A small native module, written once in Kotlin and needing a rebuild. The Android 9 and 10 hand-over, the credential activity's `AppState` and `lockout` from the combined sheet are not verified without a device.
