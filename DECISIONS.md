# Sen architecture decisions

The technical decisions behind Sen, each with the alternatives compared and the reason the choice won. Options were weighed on dev speed, scale at 10,000 transactions, what a senior React Native reviewer reads into it, risk, and fit with the threat model in [ARCHITECTURE.md](ARCHITECTURE.md).
Versions were checked against npm and package source. "(inferred)" marks a claim not verified on a device.

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
| D17 | Device loop | The owner's phone over Tailscale and Wireless debugging is the main device. The Windows emulator bridged to WSL is the fallback |
| D18 | Device driver | Maestro plus raw adb. No biometric bypass in release |
| D19 | Inner loop | `npm run check` plus a dev-only states gallery. No Expo web |
| D20 | Performance proof | Jest benches in CI, Flashlight at milestones |
| D21 | Git and CI | `main` only, a pre-commit hook and GitHub Actions |
| D22 | Build order | Serial scaffold and contracts, then parallel lanes |
| D23 | Sen's motion model | Named channels, moments as data compiled to Reanimated |
| D24 | Motion levels | A live policy hook. Calm and Off compiled from the data |
| D25 | Animated components | Shared primitives, shared values for anything Jest must prove, CSS transitions for simple presses |
| D26 | Motion verification | Jest values at chosen times, Maestro flows and settled screenshots, a release-build check on the phone |
| D27 | Showing amounts | Session state. Shown until hidden or until the app locks. Every unlock and cold start lands masked. Showing asks for biometrics |
| D28 | A phone with no screen lock | Sen refuses to run and points to the lock-screen settings. No Sen PIN |
| D29 | Copy reference | A local Expo module that marks the clip sensitive |
| D30 | Screen guard and backups | FLAG_SECURE app-wide in release, a JS privacy cover on iOS, backup and device transfer excluded |
| D31 | Security activity log and erase | A capped table in the vault. Failed unlocks wait in memory. Erase deletes only the rows the user added, behind step-up |
| D32 | Release build size | R8 minify and resource shrinking through expo-build-properties |
| D33 | Adding a transaction | A floating Add key on History, no bar |
| D34 | Catching up | History finishes only a cut-short first sync, so ordinary unlocks send nothing |
| D35 | Pull to refresh | A custom pan with Sen in the gap. `RefreshControl` is the fallback |
| D36 | Unlock timeout | 60 s for the sensor alone, 5 minutes when the screen lock can be involved, and the prompt says so |
| D37 | Date picker | The system calendar from `@react-native-community/datetimepicker`, not a drawer of 91 rows |
| D38 | Bottom sheets | Keep the expo-router native formSheet and tune it: 30 corners, iOS grabber, a drawn handle on Android |
| D39 | Pending rows | The bank reports them posted on a refresh at least 2 minutes after authorisation |
| D40 | Unlock | One Unlock key. Sen picks the route (combined sheet, sensor then screen lock, or screen lock alone) from the OS version and what is enrolled |

## D1. Storage engine: expo-sqlite with SQLCipher
**Decision.** One SQLCipher-encrypted SQLite file holds bank rows, added rows and the activity log. MMKV stays for preferences only (its synchronous read applies the theme before first paint).
**Why.** Bundled with SDK 57 and encryption is one flag (`useSQLCipher`). Parsing cost follows the visible page, where MMKV would decrypt and parse all 10k rows at unlock.
**Rejected.** MMKV with encrypted JSON records, op-sqlite, reactive stores (TinyBase, Legend State). **Verified.** On the API 36 emulator `cipher_version` is 4.7.0 community, the file starts with random bytes, and plain SQLite refuses it.

## D2. Source of truth: the local database
**Decision.** The database is the truth. The mock bank feeds it pages through a `seq` cursor with an idempotent upsert, and TanStack Query reads SQL.
**Why.** An interrupted sync recovers cleanly. One cache is cleared on lock along with closing the database, and one write path that invalidates after commit is simpler to test than a change listener.
**Rejected.** A read-through cache with nothing on disk, live queries. **Cost.** Bank data sits on disk, encrypted. The README says "cached encrypted, destroyed on sign-out".

## D3. Reading 10k rows: keyset pages and SQL sums
**Decision.** Keyset pages and plain SQL sums, with days stored in Malaysia time so groups match what the user sees. A page, a month sum and a week of day nets each take about 0.1 ms on desktop (a comparison, not phone latency).
**Rejected.** Grouping in JS, a window function for day nets (about 200 times slower), precomputed totals (drift bugs).

## D4. Search: `LIKE` on a normalised column
**Decision.** `LIKE`. It takes about 0.6 ms at 10k rows, the same as FTS5, and matches mid-word ("entral" in "KL Sentral") where FTS5 matches word prefixes.
**Rejected.** FTS5, a JS filter (needs every row in memory).

## D5. Seed data: a seeded generator
**Decision.** A seeded generator in the mock bank: deterministic for tests and screenshots, with realistic Malaysian merchants, salary days and DuitNow transfers. The first 20 rows are the design-board rows. Default 1k rows, and Settings switches between 20, 1k and 10k.
**Rejected.** Static JSON (a 10k file adds 1.2 MB), Faker.

## D6. Masking: amounts never leave the database while masked
**Decision.** Masked queries select no amount column. A separate query fills an id-to-amount map only while revealed, deleted on re-mask, so the list's data never changes on reveal.
**Why.** While masked no amount exists in JS, a claim backed by a test.
**Rejected.** Nulling the amount in a mapper, hiding digits with opacity (they stay in the screen reader tree).

## D7. List: FlashList v2, pinned to 2.3.3
**Decision.** FlashList 2.3.3, overriding the bundled 2.0.2. Cell recycling is what a reviewer expects at 10k rows, and 2.3.3 has the sticky-header and Android crash fixes (pure JS, no native risk).
**Rejected.** SectionList (headers don't stick on Android), Legend List. **Fallback.** Legend List's SectionList drop-in if sticky headers misbehave on RN 0.86.

## D8. Styling: Unistyles 3
**Decision.** Unistyles 3 with typed tokens, so `tsc` catches typos that Tailwind classes only show on the device. A theme switch does not re-render the list, and variants map onto Key, Tag and Stamp. Bricolage condensed fonts are static files via the expo-font plugin.
**Rejected.** Uniwind with Tailwind classes, plain StyleSheet with a typed theme. **Verified.** On the emulator three theme switches changed the canvas from `#F6F2E9` to `#121315` while a themed component rendered once.

## D9. Navigation: sheets and the add flow are protected routes
**Decision.** Every sheet and the add flow are routes inside `Stack.Protected`, so locking removes them with no extra code. Native controls clash with the brand and are used only for the date picker (D37).
**Rejected.** Component modals (they survive the lock), `@expo/ui` native controls everywhere.

## D10. Rendering Sen: react-native-svg with Reanimated
**Decision.** An SVG rig driven by Reanimated, plus a MotionDirector reducer so only one Sen animates. It is code agents can write and diff. Details are D23 to D26 and ARCHITECTURE.md › Motion.
**Rejected.** Skia (a new drawing API for one character), Rive and Lottie (agents can't author them).

## D11. React Compiler: on
**Decision.** On, the SDK 57 default. It removes a class of memo mistakes agents make. House rules: shared values use `.get()` and `.set()`, hook functions are destructured, list rows keep an explicit `memo`.
**Rejected.** Off.

## D12. Client state: Zustand wrapping the session reducer
**Decision.** Zustand wrapping the same pure, exhaustive reducer, so the lock timer and background listener read the latest state outside React and selectors keep rows from re-rendering.
**Rejected.** Reducer with context, XState (about half a day for five states), Jotai (spreads one machine across atoms).

## D13. Folder structure: `src/` with the brief's layers
**Decision.** The brief's `models`, `services`, `features` and `components` layers inside Expo's `src/`, with the `@/*` alias and kebab-case files. The ESLint plugin in `eslint-config-expo` enforces layers, cycles and the `console` ban with no extra packages.
**Rejected.** Root-level mixed-case folders, Expo's default layout.

## D14. Security scope
**Decision.** Ten controls built, ranked by reviewer impact against cost: biometric unlock with every error mapped plus the route guard; masking and the show toggle (D27); zod at every boundary; step-up on add and delete; encryption at rest; screen protection in release; idle lock and re-lock after leaving; the lint-enforced logging rule; the description sanitiser; the custom keypad. The activity log is cut first if late.
**Not built.** A biometric-bound key: it loses the passcode fallback on Android and wipes data when a fingerprint is enrolled. The README says so, since an honest "what this does not protect against" earns more trust than half-built crypto.

## D15. Errors: tagged unions
**Decision.** Tagged unions, thrown only at the TanStack seam. Every error kind maps to a designed state, `tsc` fails on an unhandled kind, and screens never show raw messages.
**Rejected.** Thrown `Error` subclasses, `Result` everywhere (fights TanStack Query's rejected promises).

## D16. Tests: pure tables plus screen tests through ports
**Decision.** Pure table tests and screen tests through small ports with fakes. A `node:sqlite` adapter runs real SQL in Jest. A global coverage gate is skipped because it makes agents write filler tests.
**Rejected.** Mocking every native module, a coverage gate.
**Watch out.** Under RNTL 14, `renderRouter` must be awaited and its pathname helpers are lost. It also turns on fake timers.

## D17. Device loop: the owner's phone, with the emulator as fallback
**Decision.** The owner's phone (Redmi Note 13 Pro 5G) on Tailscale, over Wireless debugging through the one adb server on Windows, is the default device, driven by `npm run device:verify` and `scripts/phone.sh` (CLAUDE.md › Environment). The Windows emulator bridged to WSL is the fallback. The phone is the real target, so proof, performance numbers and the demo video come from it.
**Rejected.** An emulator inside WSL (needs sudo, software rendering), EAS Simulator (limited access, costs money).

## D18. Device driver: Maestro plus raw adb
**Decision.** Maestro flows for verification and raw adb for fingerprint taps, deep links and logs. Maestro is Expo's documented path and is used by Bluesky, React Navigation, Ignite, Reanimated Carousel and Mattermost. The flows are not a shipped E2E suite, and the README says so.
**No bypass.** None in a release build. Flows use a dev-only `?auth=pass|cancel|real` override on `sen://dev/states`, compiled out of release, and `scripts/check-release-auth.sh` fails the build if it survives.
**Rejected.** agent-device (newer, contact sheet macOS-only), Detox (test build and native setup), argent (unproven on Linux), raw adb alone.

## D19. Inner loop: `npm run check` plus a states gallery
**Decision.** Jest, tsc and lint, plus a dev-only gallery where one deep link renders any screen state from fixtures shared with RNTL tests.
**Rejected.** Expo web screenshots: they need web fallbacks for three security modules and lay out differently from native.

## D20. Performance proof: Jest benches and Flashlight
**Decision.** Jest benches gate every push in CI, and Flashlight gives FPS and CPU on release builds at milestones.
**Rejected.** DevTools as proof (diagnosis only), Perfetto (too slow to read).

| Metric | Budget |
| --- | --- |
| Scroll FPS on 10k rows | 55 or more |
| Unlock to first paint | 500 ms or less |
| Search at p95 | 100 ms or less |
| Each selector on Node | 16 ms or less |

## D21. Git and CI: `main` only, a hook and Actions
**Decision.** A zero-dependency pre-commit hook (typecheck plus related tests) makes every commit build, and CI is the check reviewers can see. Short messages, no attribution lines, and parallel agents use worktrees that fast-forward `main` so history stays linear.
**Rejected.** CI only, neither.

## D22. Build order: serial scaffold, then parallel lanes
**Decision.** A serial scaffold installs every dependency and stubs every route, then parallel lanes own separate folders so there are no shared-file merge fights.
**Rejected.** One agent strictly serial, one agent per screen (constant shared-file edits, security bolted on last).

## D23. Sen's motion model: channels and moments as data
**Decision.** Moments are data compiled into `withSequence`, `withTiming` and `withSpring`, with one shared value per channel.
**Why.** Tuning means editing a table, not worklets. Each SVG part redraws only when its own channel moves. CSS animations can't move SVG groups, ignore reduced motion and can't be seen in Jest. SVG transforms use a worklet-computed `matrix`, the only form native SVG accepts.
**Rejected.** Hand-written worklets per moment, one clock sampling every track, Reanimated CSS animations.
**Cost.** A compiler of about 80 lines. RNSVG's `GProps` omits `matrix`, so the one `AnimatedG` adds it to the type. Verified on the emulator, where the static clip `G` still cut the face at the rim.

## D24. Motion levels: a live policy, Calm compiled from data
**Decision.** A live policy hook, with Calm and Off compiled from the moment data.
**Why.** `useReducedMotion()` is read once and never updates. `ReduceMotion.System` jumps animations to their end, so DESIGN's 150 ms Calm crossfade must come from the data. The lockout cool-down uses `ReduceMotion.Never`, and CSS transitions (which ignore reduced motion) zero their duration from the same policy.
**Rejected.** `ReduceMotion.System` everywhere.

## D25. Animated components: shared primitives
**Decision.** Shared primitives in `src/motion/` and `src/components/`. Motion Jest must prove runs on shared values, which work with fake timers (one drove 20 rows with zero parent re-renders). Key presses and the segmented pill use CSS transitions. Key presses use Gesture Handler's `Pressable`, since RN's can drop presses on Android's fast animation path. No row holds animation state, so recycling is safe.
**Rejected.** Each lane building its own animations.

## D26. Motion verification: the industry pattern
**Decision.** What Reanimated's docs and 15 large RN apps (Expensify, Bluesky, Rainbow, Mattermost, FlashList and others) do. Jest uses fake timers with `toHaveAnimatedStyle` and `toHaveAnimatedProps` at chosen times, with literal numbers copied from DESIGN.md and motion maths in pure functions. Maestro uses `waitForAnimationToEnd` and `assertScreenshot` on settled screens against baselines the owner approves. Feel is judged by eye from Maestro video and the Perf Monitor on a release build.
**Rejected.** A time-freezing motion lab, mid-animation goldens, ffmpeg video diffs and canvas parity tests. No surveyed app does these.
**Watch out.** Keep the emulator's animation scales on. Reanimated reads a zero scale as reduced motion and every moment jumps to its end.

## D27. Showing amounts: session state, masked on every unlock and cold start
**Decision.** `amountsHidden` lives in the session store. It starts true, goes true whenever the database closes, and is never saved. Showing asks for biometrics every time, hiding never does, and a reveal lasts until the user hides or the app locks. History's key is the only control.
**Why.**
- The brief asks for masked by default, and a reviewer who relaunches must see masked. A saved setting reopened showing money.
- An in-memory flag is masked by construction. A pref reset on launch needs a write that a crash or new entry point can skip.
- The close path already clears the query cache on every lock, so the flag resets in the same `setState` for idle, background, manual and sign-out locks.
- Session scope is the common banking pattern (inferred, not surveyed). A timer that re-hides mid-read fights the user.
**Rejected.** A timed reveal with a countdown ring, one saved `hideAmounts` setting, a saved setting reset on lock and launch.
**Watch out.** MMKV keeps no amounts key. Outside `amounts.ts` and tests, lint allows an `amountsHidden` property only as the literal `true`. A lock unmounts History, so the next mount starts masked and Re-mask plays only on "Hide amounts".

## D28. A phone with no screen lock: refuse and point to settings
**Decision.** Lock and Welcome show "Set a screen lock to use Sen" with one key, "Open lock-screen settings" (Android `SET_NEW_PASSWORD`, iOS opens Sen's Settings page). No Sen PIN.
**Why.** Banking apps (Malaysian banks, Revolut) refuse to run without a device lock. The OS and secure hardware count wrong tries, where a JS-checked PIN makes the limit ours and a copied data folder could try PINs freely. A PIN also needs setup, change, forgot and lockout screens.
**Rejected.** A Sen PIN for phones with no lock, a Sen PIN for everyone.
**How.** `getEnrolledLevelAsync` returning `NONE` maps to level `none`, re-read each time the app becomes active. A failed read keeps the last level (or counts as a passcode on launch). Lockouts belong to the OS (D40). **Cost.** A reviewer's emulator needs a PIN, as the API 36 AVD has.

## D29. Copy reference: a local module marks the clip sensitive
**Decision.** `modules/sen-clipboard`, one function in Kotlin and Swift. Android 13+ shows a clip marked `EXTRA_IS_SENSITIVE` as dots in the copy preview, and only native code can set it (below 13 it sets the same key as a string). iOS has no flag, so the module writes the item local only, with a two-minute expiry (inferred: not built on a Mac).
**Rejected.** `expo-clipboard` 57.0.2 (cannot mark a clip sensitive), RN's deprecated `Clipboard`. **Cost.** One native rebuild. Without the module a copy reports failure and points at the selectable reference.

## D30. Screen guard, privacy cover and backup rules
**Decision.**
- **FLAG_SECURE app-wide in release.** `preventScreenCaptureAsync` runs from the root layout, retries on foreground after a native failure, and re-engages after Android Activity recreation. Guarding only unlocked screens leaves a gap on lock changes. Dev builds stay open for screenshots.
- **JS cover on iOS only.** The native blur starts on `willResignActive`, which also fires under the Face ID sheet and would blur every unlock. The cover skips `inactive` while `isAuthenticating()` and always covers `background`. Android needs none, since FLAG_SECURE blanks recents.
- **Backups.** `plugins/with-no-backup.js` writes `dataExtractionRules` and `fullBackupContent` excluding every domain, because on Android 12+ `allowBackup="false"` alone can leave device transfer open. `expo-secure-store` runs with `configureAndroidBackup: false`.
**Rejected.** The expo native blur, `allowBackup: false` alone, `expo-build-properties` (no such option).
**Watch out.** formSheet and fullScreenModal present above the root view, so the delete sheet and add flow each mount their own `PrivacyCover`. The iOS switcher snapshot is blanked by the secure canvas (inferred, unverified without a Mac).
**Sheet windows (finding).** On react-native-screens 4.26.2 a formSheet is a `ScreenStackFragment` inside the activity's own window, so sheets inherit FLAG_SECURE. A release-APK screenshot with the Delete sheet open is still owed. `scripts/check-release-guard.sh` fails if `ScreenStack.kt` stops mapping FORM_SHEET to that fragment.

## D31. Security activity log and erase
**Decision.** The `activity_log` table lives in the SQLCipher file, capped at 50 rows by a trigger, so sign-out destroys it with the data it describes. Erase deletes only the rows the user added.
**Why.**
- A failed unlock or lockout is held in memory (at most 50) and written at the next successful unlock, because the vault is never opened without the check. A process killed first loses them.
- `ActivityEventSchema` is a strict union with no amount field. Add, delete and undo carry the description, never the amount, and it stays until the event ages out. A failed log write never blocks the action. Only changes that leave the phone open longer are logged settings.
- "Erase transactions I added" asks for step-up, then deletes every `source = 'manual'` row and the undo copy in one transaction (`eraseManual`) and logs `tx.erased` with the count. Bank rows, vault, key and prefs stay, so it differs from Sign out. A failed delete rolls back and says so.
**Rejected.** A separate MMKV list, nothing persisted, opening the vault to log a failed unlock, an Erase that wipes everything (the first cut).
**Cost.** A small SQL module, a recorder with a hold list, and a few `record` calls.

## D32. Release build: R8 minify and resource shrinking
**Decision.** Both on through `expo-build-properties` in `app.config.ts`, which survives `expo prebuild` regenerating the git-ignored `android/`.
**Rejected.** Expo's defaults, a hand edit of `build.gradle`.
**Watch out.** R8 can strip classes reached by reflection. The keep rules of the dependencies were read from source, not yet run under R8. The release smoke of unlock, add, delete and lock stays the gate, and `mapping.txt` ships with the reviewer APK. Fix a breakage with `extraProguardRules`, not by turning minify off. The size gain is unmeasured.

## D33. Adding a transaction: a floating key
**Decision.** A floating 60 x 60 "+" at the bottom right of History, loud at every scroll position and named "Add a transaction" for TalkBack and flows. It rises a fixed 92 pt with the undo toast (a two-line toast still clears by about 6 pt, inferred from font sizes). The most common write sits under the right thumb, as in Material, Copilot Money and Buddy, with no route changes.
**Rejected.** A two-tab bar with Add in the middle (needs a tabs route group, and tabs navigate rather than act), a thumb dock, the old header key, the board's grow and shrink on scroll.

## D34. History catches up only a cut-short first sync
**Decision.** Catch up when the cursor is above 0 and the feed's end was never reached. The end is a `meta` key (`bank.feedEnd`) committed with the last page and cursor, and `resetBankRows` deletes it. An older install with a cursor and no key catches up once.
**Why.** Catching up on every mount sent a request on every unlock, used up a reviewer's armed one-shot fault and held Settings on "Syncing…".
**Rejected.** Every mount with a cursor, a `first_sync_done` column (a migration for one boolean). **Cost.** A feed that grows after the last page is fetched only by a pull.

## D35. Pull to refresh: a custom pan, with the platform control as fallback
**Decision.** A `Gesture.Pan` beside the list, with the gap and Sen drawn by us, pulling only at offset 0. The list's scroller is Gesture Handler's `ScrollView` with `simultaneousHandlers`, since a plain RN scroller cancels a parent pan. The board's pull, spin and landing are the signature moment, and FlashList's `refreshing` (`RefreshControl`) cannot hold Sen.
**Not verified.** Spike R1 (the pan beside FlashList on the phone, normal scrolls still scrolling) has not run. Unit tests prove the maths and state, not touch arbitration. If it fails, revert the pull commit and keep `RefreshControl`.

## D36. Unlock timeout: 60 s for the sensor, 5 minutes for the screen lock
**Decision.** Foreground time only, the clock paused while the app is not `active`. 60 s covers the sensor alone (`PROMPT_TIMEOUT_MS`, Android 9 and 10). Any sheet that can end in the screen lock waits 5 minutes (`CREDENTIAL_TIMEOUT_MS`). A timeout ends as its own reason, `timedOut`: Lock says so and keeps Unlock ready, each step-up has its own copy, and Show amounts stays hidden with a toast.
**Why.**
- The system dialog reports no progress, so Sen cannot tell typing from an untouched dialog or reset the clock. The owner confirmed 60 s.
- Inside the combined sheet a user may switch to a slow pattern, and Android imposes 30 s after five wrong tries, so 60 s would cancel mid-entry. On Android 9 and 10 the system screen takes the app out of `active`, so the clock pauses (inferred, not seen on a device).
**Rejected.** No timeout (a prompt the OS never answers strands Lock on "Checking it's you"), a longer timeout for everything, background-only time.
**Watch out.** `timedOut` is not a failed try: no "Too many tries" count, no `auth.failed` log, no blocked steer, no store fault.

## D37. The date is picked in the system calendar
**Decision.** `@react-native-community/datetimepicker` 9.1.0. Android opens `DateTimePickerAndroid.open({ mode: 'date' })` (the default dialog, since Material 3 pickers need a `Theme.Material3.DayNight` app theme and Sen's is AppCompat). iOS shows `display="inline"` in the sheet the drawer used. Today, Yesterday and Pick a date stay.
**Why.** It is the long-standing standard around the platform dialog, and the old drawer of 91 days showed no month grid or weekday.
**Rules.**
- `minimumDate` is the first allowed day and `maximumDate` the end of today, rechecked with `isInAddWindow`. A `DayKey` is a Malaysia day, sent to the picker as the same y/m/d at noon.
- Dismissing changes nothing, leaving the page closes the dialog, and today is read at pick time so a dialog left past midnight still refuses tomorrow.
- `app.config.ts` holds hex copies of the dialog colours (Expo loads it without `src/`), and a jest test fails on drift from `theme/colors.ts`.
**Rejected.** The custom drawer, `@expo/ui`'s date picker (newer, less used, inferred), a custom calendar grid.
**Watch out.** The dialog follows the phone's light or dark mode, not Sen's Theme setting. This is known and stays. The iOS `loud` accent is inferred until an iOS check. Needs a native rebuild.

## D38. Bottom sheets: keep the native formSheet and polish it
**Decision.** The Delete, Erase, Privacy, Sign out and Reset demo sheets stay expo-router `formSheet` routes (D9). Shared `sheetOptions` in `src/app/_layout.tsx` set 30 corners, an Android elevation, the iOS grabber and a `canvas` surface. Android ignores `sheetGrabberVisible`, so `SheetSurface` draws a decorative Material 3 handle there only. It is Expo's documented route, hardware back pops it, there is no new dependency, and the sheets inherit FLAG_SECURE (D30).
**Rejected.**
- `@expo/ui` BottomSheet: a component, so each sheet needs a wrapper route to keep D9. It still had `RNHostView` touch and Reanimated fixes in 57.0.23 and 57.0.24, no Android corner radius, and needs a mock and rebuild.
- `@lodev09/react-native-true-sheet` 3.11: also a component, third party, and a rebuild.
**Watch out.** The board draws `paper` sheets with `canvas` rows, and the app keeps `canvas` sheets with `paper` rows. `SheetSurface` paints the surface itself because the gallery renders views outside the route.

## D39. Pending rows post on a later refresh
**Decision.** The simulated bank is the source of truth, as in Plaid's sync (`added` and `modified`). A refresh page carries `modified`, a list of `{ id, settledAt }`, for pending rows at least 2 minutes past authorisation (`SETTLE_AFTER_MS`). `settledAt` is `postedAt` plus 2 minutes, a pure function of the row and the injected `now`, so tests need no sleep and retries report the same change. Before this, every pending row stayed pending for ever.
**Rules.**
- Only a request past the end of the feed carries `modified`, so the first open still shows the board's pending rows and they post on the first pull. A row a refresh just brought stays pending until a later pull.
- `sync` applies it as `UPDATE tx SET status = 'posted', settled_at = ... WHERE source = 'bank' AND status = 'pending'` in the page's own transaction. It never inserts, never touches added or posted rows, and clamps `settled_at = max(?, posted_at)`. Posting never touches `amount_minor`, so masking is unchanged.
- Migration v2 adds a nullable `settled_at`. Each migration records `schema.minReader` in `meta`, and `migrate` throws `SchemaTooNewError` only when it exceeds the app's version, so v1 and v2 files stay readable. Builds that predate this check still reset a v2 file.
- The bank's state (feed anchor and `{ seq, postedAt }` of minted rows per dataset size) persists in MMKV `bank.state`, so a restart does not re-anchor the feed. `resetBank` writes the default.
**Rejected.** A phone-side timer (the phone invents bank state), posting every pending row on the next refresh (a reviewer never sees one pending on a pull), leaving it.

## D40. One Unlock key, and Sen picks the route
**Decision.** `routeOf(os, api, level)` in `src/features/auth/prompt.ts` picks the prompt for unlock and every step-up. `prompt.ts` is the only caller of `authenticateAsync`.

| Phone | Strong biometric enrolled | No strong biometric |
| --- | --- | --- |
| Android 11 and later | The combined sheet, `BIOMETRIC_STRONG \| DEVICE_CREDENTIAL`, with its own "Use PIN, pattern or password" button. After five misses the OS moves to the screen lock | The screen lock alone, through `modules/sen-auth` |
| Android 9 and 10 | The sensor alone. A lockout or an unavailable sensor hands over to the screen lock in the same call | The screen lock alone, through `sen-auth` |
| Android 7 and 8 | The combined sheet | The screen lock alone, through `sen-auth` |
| iOS | `deviceOwnerAuthentication`: Face ID or Touch ID, then the passcode in one sheet | The same call, which goes straight to the passcode |

**Why.**
- The old single call opened the fingerprint sheet again from every "Use device passcode" key, and a phone with a weak or no biometric still opened a fingerprint sheet first.
- On Android 9 and 10 the strong-plus-credential pair is unsupported (androidx.biometric 1.2.0-alpha04, read from bytecode) and `PromptInfo.Builder.build()` throws outside expo's try, so unlock probably crashed there (minSdk is 24). Below 30 `sen-auth` uses the keyguard activity.
- Android never reports a single miss and a lockout inside the combined sheet never reaches JS, so Sen's own lockout card and "N more tries" count were unreachable. The OS owns misses and lockouts, and those views, copy, flows and the dev override values `fail` and `lockout` were deleted.
- The owner chose simplicity: no choice between biometrics and passcode on screen.
**Rejected.**
- One key with the combined sheet everywhere: keeps the API 28 and 29 crash.
- Two keys, Unlock and Use screen lock: built and tried, then rejected. It made the user choose up front, needed an unreachable lockout card, and on Android could not offer "Use screen lock" from a plain Cancel (expo maps Cancel and dismissal both to `user_cancel`).
- Patching `expo-local-authentication`: SDK upgrades overwrite it.
- A Sen password: rejected by the owner (JS-checked attempt limit, no recovery without a server, a second secret, and it breaks D28).
**Rules.** A test drives every route on API 24 to 36 and fails if `strong` reaches expo without `disableDeviceFallback: true` on 28 or 29. If a lock arrives during the first prompt, the hand-over is skipped and the check ends as a cancel. A prompt in front is not a trip away: a pass keeps the session and any other end applies the away check. With no screen lock `sen-auth` answers `passcode_not_set`, which maps to `noLock` (D28). Clocks are in D36. The key names a sensor only when a strong biometric is enrolled, says "biometrics" when Android cannot say which, and otherwise says "Unlock". Copy says "screen lock" on Android and "passcode" on iOS.
**Cost.** A small Kotlin module needing a rebuild. The Android 9 and 10 hand-over, the credential activity's `AppState` and `lockout` from the combined sheet are not verified without a device. Accepted gap: on an API 30+ hand-over, `sen-auth`'s 2 s watchdog catches only a prompt fragment that never appears. A fragment that stays attached but shows nothing makes Sen wait out the 5 minute clock before "Try again".
