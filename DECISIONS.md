# Sen architecture decisions

Each record below is an open technical decision. It lays out the options, weighs them against the same criteria, and gives a recommendation. The owner makes the call and writes it in **Owner pick**. Nothing in PLAN.md starts until every record has a pick.

The product and design are already decided. See [DESIGN.md](DESIGN.md) and the locked rows in [CLAUDE.md](CLAUDE.md). These records cover how to build it.

## How to read a record

- **Criteria.** Every option is rated on the same five things. Dev speed is how fast agents can build and check it in about 3 days. Scale is how it behaves at 10,000 transactions. Reviewer signal is what a senior React Native reviewer reads into it. Risk covers build and runtime risk. Security is how well it fits the threat model in [ARCHITECTURE.md](ARCHITECTURE.md).
- **Evidence.**
  - Claims marked **V** were checked on 2026-10-15 against a primary source (npm, release notes, package source, official docs) or this machine.
  - Claims marked **I** are inferred.
  - Timings marked **measured** come from a SQLite benchmark on the WSL desktop (Node 24, SQLite 3.53). They compare options. They are not phone latencies.
- **Sources.** Four research passes, one per area: data, UI, core, and verification. The bundled versions come from https://unpkg.com/expo@57.0.28/bundledNativeModules.json (V).

## Summary

| # | Decision | Recommendation | Owner pick |
| --- | --- | --- | --- |
| D1 | Storage engine | expo-sqlite with SQLCipher | |
| D2 | Local-first shape and reads | SQLite is the source of truth. The mock bank syncs into it. TanStack Query reads SQL | |
| D3 | Reading 10k rows | Keyset pages plus plain SQL sums | |
| D4 | Search | `LIKE` on a normalised column | |
| D5 | Seed data | Seeded generator, 20 / 1k / 10k reviewer toggle | |
| D6 | Masking with a database | Masked queries never select amounts. A revealed-only amounts map feeds rows | |
| D7 | List component | FlashList v2 pinned to 2.3.3 | |
| D8 | Styling | Unistyles 3 with typed tokens | |
| D9 | Navigation and sheets | Every sheet and the add flow are routes inside `Stack.Protected` | |
| D10 | Rendering Sen | react-native-svg with Reanimated, plus a MotionDirector reducer | |
| D11 | React Compiler | Keep it on | |
| D12 | Client state | Zustand wrapping the pure session reducer | |
| D13 | Folder structure | `src/` layers from the brief, kebab-case, lint-enforced | |
| D14 | Security scope | Build ranks 1 to 10. Cut the activity log first. Explain the limits in the README | |
| D15 | Error model | Tagged unions, thrown only at the TanStack seam | |
| D16 | Tests | Pure table tests plus RNTL screen tests through ports, real SQL in Jest | |
| D17 | Device loop | Windows emulator bridged to WSL | |
| D18 | Device driver | agent-device plus raw adb, no biometric bypass | |
| D19 | Inner loop | Jest, tsc and lint, plus a dev-only states gallery. No Expo web | |
| D20 | Performance proof | Jest benches in CI, Flashlight at milestones | |
| D21 | Git and CI | Pre-commit hook plus GitHub Actions | |
| D22 | Build order | Serial scaffold, then parallel lanes on separate folders | |

---

## D1. Which storage engine holds transactions?

**Context.** Local first at 10,000 rows means the simulated bank data must persist, not just sit in memory. The engine decides how we query, encrypt, migrate and test. It is the root of D2 to D6.

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk | Security |
| --- | --- | --- | --- | --- | --- |
| A. MMKV with encrypted JSON records (current plan, extended) | High. Already designed | Medium. Unlock parses all 10k rows (about 18 ms on desktop, measured, likely a few hundred ms on a phone, I). Then every query is a JS loop | Low to medium. A key-value store used as a table | Low | Good, but the whole dataset is decrypted into the JS heap |
| B. expo-sqlite with SQLCipher | Medium. Needs a schema, migrations and a test adapter | High. Indexed pages and sums under 0.1 ms on desktop (measured). Only the visible page crosses into JS | High. Encrypted SQLite, keyset paging and a migration ladder | Medium. Bundled at `~57.0.4` (V). SQLCipher is one config flag, `useSQLCipher` (V), and needs a dev build, which we already use | Strong. The whole file is AES-256. A raw 64-hex key skips PBKDF2, so opening is fast (V) |
| C. op-sqlite with SQLCipher | Medium to low | High | Medium. Known to RN specialists | Medium. Not in the SDK 57 bundle, so RN 0.86 fit is unproven (I) | Strong |
| D. TinyBase or Legend State over storage | Low. A new mental model | Medium. The whole table lives in JS | Mixed | High. Legend State v3 is still beta (V) | Weak. Decrypted data sits in a JS store |

**Recommendation.** B, expo-sqlite with SQLCipher.
- It is bundled with the SDK and encryption is a config flag.
- It is the only option where parsing cost grows with the page, not the dataset.
- Added transactions and the activity log move into the same encrypted file, so the MMKV vault goes away.

You give up about half a day against A for the schema, migrations and test adapter.

**Sub-choice: preferences.** Settings such as the theme are not sensitive.
- **Keep MMKV for preferences only.** Its synchronous read lets the theme apply before the first paint. Unistyles (D8) needs Nitro anyway, so MMKV adds little.
- **Use `expo-sqlite/kv-store` in a separate, unkeyed database.** This drops MMKV entirely, but the read is async and the theme may flash on launch.

Recommendation: keep MMKV for preferences.

**Would change the call.** Fall back to A, capped at 1k rows, if the SQLCipher build fails on the WSL Android toolchain within the first two hours.

**How to prove it.** A two-hour spike.
1. Add the plugin and run a dev build.
2. Run `PRAGMA cipher_version`. A non-empty result proves SQLCipher is linked.
3. Pull the database file with `adb exec-out run-as <pkg> cat databases/sen.db`. It must not start with `SQLite format 3`.

**Owner pick.**

---

## D2. What is the source of truth, and how does the UI read it?

**Context.** Today the plan reads the mock API through TanStack Query and keeps nothing on disk. Local first flips that. The data researcher and the core researcher disagree on how screens read the local store, so this record holds both views.

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk | Security |
| --- | --- | --- | --- | --- | --- |
| A. Read-through cache (current) | High | Low. Refetches everything on every cold start | Low. Not local first | Low | Strong. Nothing at rest |
| B. SQLite is the truth. The mock bank syncs in with a cursor. TanStack Query reads SQL and is invalidated by the one write module | Medium | High | High. Repository, cursor sync, idempotent upsert, query keys | Low | Strong. `queryClient.clear()` on lock still empties every cache |
| C. Same sync, but screens read through live queries (Drizzle `useLiveQuery` or the SQLite change listener). TanStack only runs the sync and the writes | Medium to low | High | Medium to high | Medium. Live queries keep their own cache, so lock needs a second clear | Medium. A second cache is easy to forget on lock |

**Recommendation.** B.
- **Single source of truth.** The database. The mock bank is an inbox with a `seq` cursor. A pending row that later posts arrives as an update, which a date cursor would miss (I).
- **Sync.** Pages are zod-parsed and upserted in one transaction. A retried or interrupted sync ends in the same state.
- **Writes.** There is exactly one write path, and it calls `invalidateQueries(['tx'])` after commit. With one writer, explicit invalidation is simpler and easier to test than a change listener.
- **Lock.** `queryClient.clear()` plus closing the database, so locked also means no open keyed handle.
- **Network errors.** These come from the sync query. A failed refresh keeps the local list and shows a banner.

You give up the README line "bank data is never written to disk". It becomes "bank data is cached encrypted and destroyed on sign-out."

**Would change the call.** If you want "bank data never touches disk" as a security headline, keep A for bank rows and use SQLite only for added rows and the log. Then 10k rows live in memory.

**How to prove it.** A unit test runs `sync()` twice with the same cursor, then interrupts after page 1 and resumes. The row count and a hash of the table must match in all three runs. A second test adds a row and checks a mounted list shows it with no manual refetch.

**Owner pick.**

---

## D3. How do the list, day totals and month card read 10k rows?

**Context.** History shows day slips with a day net, plus a month card with money in and out, and the All/In/Out filter recomputes it.

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. Load everything, group in JS | High | Low to medium. 7 ms to sort and group on desktop (measured), plus moving 10k rows into JS | Low | Jank on low-end phones |
| B. Keyset pages of 100 into the list. Month and day totals are plain `SUM` queries over a date range | Medium | High. Page 0.1 ms, month sum 0.08 ms, 7-day nets 0.08 ms on desktop (measured). Uses a covering index (measured) | High | Low. Day nets need their own query because a page can split a day |
| C. B with a window function for day nets | Medium | Medium. 19 ms per page (measured), about 200 times slower | Medium | Medium |
| D. B with precomputed total tables | Low | High | Medium | High. Totals can drift from rows |

**Recommendation.** B. Store `posted_at` in UTC and a `day` column in Malaysia time (UTC+8), so day boundaries match what the user sees. You give up about two hours against A for page flattening and the separate totals query.

**Would change the call.** If the default dataset stays small and 10k is only a stress test, A is acceptable, as long as the list is still FlashList.

**How to prove it.** Run the SQL benchmark. On device, log `performance.now()` around each query, then scroll 10k rows with `adb shell dumpsys gfxinfo <pkg> framestats`. Pass when janky frames stay under 5% on the emulator.

**Owner pick.**

---

## D4. How does live search work across 10k descriptions?

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. `LIKE '%q%'` on a lowercased, accent-stripped column | High | 0.55 to 0.72 ms with count and total (measured) | Medium. Correct and plain | Low |
| B. FTS5 full-text index | Medium to low. Triggers and query escaping | 0.6 ms (measured), the same as A | High on paper | Medium. Matches word prefixes only, so "entral" no longer finds "KL Sentral" (I) |
| C. Filter in JS memory | High | 0.5 ms (measured) | Low | Needs every row in JS, which undoes D3 |

**Recommendation.** A. It matches text typed mid-word and is as fast as FTS5 at 10k. The README states why FTS5 was not needed. Escape `%` and `_` in the input, and debounce with `useDeferredValue`.

**Would change the call.** A device measurement over 16 ms, or a target of 100k rows.

**How to prove it.** Seed 10k rows, search "entral", and assert the count equals a JS filter over the same seed.

**Owner pick.**

---

## D5. How is seed data generated, and how does the reviewer pick a size?

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. Static JSON files for 20, 1k and 10k | High, but the 10k file adds about 1.2 MB to the bundle | Low | Low |
| B. A seeded generator inside the mock bank (mulberry32), with weighted Malaysian merchants and amounts in integer sen | Medium. About two hours with tests | High. Deterministic and property-testable | Low |
| C. Faker | Medium | Low. Generic, not Malaysian | Low |

**Recommendation.** B.
- **First rows.** The first 20 rows at every size are the rows from the design boards, so screenshots match the boards.
- **Default size.** 1k, about three a day for a year.
- **Stress size.** 10k, labelled as such.
- **Reviewer setting.** "Dataset size: 20 · 1k · 10k" under For reviewers. Changing it resets only bank rows, then syncs with a progress line. Added rows and the log survive.
- **Same path as real data.** Seed data arrives through the same sync and zod boundary as real data, so "Bad data" corrupts a real sync page.

**Would change the call.** If sync with progress does not fit the budget, write the seed straight into the database and keep the mock API only for "new transaction on refresh".

**How to prove it.** The same seed gives identical output twice. Every row passes the schema. No row is in the future.

**Owner pick.**

---

## D6. How does "mask at the source" work with a database?

**Context.** The rule is that masked screens never hold an amount. With SQL there is a stronger option, never selecting the amount while masked. The UI research adds a second goal. Revealing must not rebuild the list's data at 10k rows.

| Option | Dev speed | Scale (10k) | Reviewer signal | Security |
| --- | --- | --- | --- | --- |
| A. Select everything, null the amount in a view-model mapper (current) | High | Medium. Every reveal rebuilds the list's data (I) | Medium | Medium. Amounts sit in the query cache while masked |
| B. Masked queries have no amount column at all (typed `MaskedRow`). Revealed queries replace them | Medium | Medium. Reveal swaps the whole list's data | High | Strong |
| C. B for list pages, plus a separate revealed-only query that fills an `id → amount` map. Rows read it through `useAmountView(id)` | Medium | High. List data never changes on reveal. Only mounted rows re-render, about 20 (I) | High. Typed masking plus stable list data plus UI-thread motion | Strong. The amounts map only exists while revealed and is removed on re-mask |
| D. Always render digits and hide them with opacity | High | Highest | Medium | Fails. Digits sit in the screen reader tree while masked |

**Recommendation.** C. It combines the two researchers' proposals.
- **Pages.** List pages and masked totals never select `amount_minor`, and the types make reading one a compile error.
- **On reveal.** One query loads amounts for the loaded range into a map. A single `SharedValue` drives the coin-to-digit animation on the UI thread.
- **On re-mask.** `removeQueries(['tx','revealed'])` deletes the map.
- **What stays exposed.** The honest limit shrinks to "while revealed, amounts sit in JS memory".

**Would change the call.** If D2 keeps bank data in memory only, there is no column to leave out. Use the stable-data half alone.

**How to prove it.**
1. Render History masked. `JSON.stringify(screen.toJSON())` contains no seeded amount, totals included.
2. Reveal, and the digits appear. Re-mask, and the revealed queries are empty.
3. A spy shows the list's `data` reference is unchanged across reveal and hide.

**Owner pick.**

---

## D7. Which list renders 10k rows with sticky day headers?

**Context.** The current plan says SectionList, on the grounds that FlashList "is not worth it at about 50 rows". At 10k that reason is gone. On Android, SectionList headers don't stick by default (V, RN source).

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. SectionList | High | Low to medium. No recycling. Blank cells on fast flings (I) | Low. Reads as not planning for scale | High perf risk |
| B. FlashList v2 pinned to 2.3.3 | High. Ships a Jest setup (V) | High. Recycling, no size estimates | High. What a senior reviewer expects | Medium. SDK 57 bundles 2.0.2, which predates the sticky-header fixes in 2.2.1 and 2.2.3 and an Android crash fix in 2.3.2 (V). FlashList is pure JS, so overriding the version carries no native risk (V) |
| C. FlashList at the bundled 2.0.2 | High | High, minus the fixes | High | High. Missing those fixes |
| D. Legend List 3.6 with its SectionList drop-in | High | High (I, not benchmarked) | Medium to high | Medium. Sticky headers need extra wiring. No Jest guidance found |

**Recommendation.** B. Rows are a typed union, day top, transaction and day bottom, built by one pure `buildHistoryRows()`. Rows are memoised, callbacks are hoisted, and no row holds animation state. Exclude FlashList from `expo install --check`.

You give up `RefreshControl` as the only free pull-to-refresh. Android has no overscroll, so Sen "rising out of the gap" needs a custom pan gesture. Ship `RefreshControl` with Sen spinning in the list header first.

**Would change the call.** Switch to D if, in a 30-minute spike, FlashList's sticky headers jump on RN 0.86.

**How to prove it.**
1. A Jest render of 10k rows mounts fewer than 60 row components.
2. FlashList's `useBenchmark` on device reports FPS and blank area.

**Owner pick.**

---

## D8. Which styling system carries the custom brand?

**Context.** DESIGN.md defines semantic tokens for light and dark, hard ink shadows and two typefaces. Expo's skill says to use inline styles and native system colours. That advice suits apps that look native. Sen is custom-branded, and Android's dynamic colour would replace the cream and ink palette with wallpaper colours.

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. Uniwind, Tailwind classes (current) | High. Agents write Tailwind fluently | Medium. The free tier re-renders on theme change (V). Class lookups on every row (I) | Medium | Medium. A typo like `bg-canvs` passes `tsc` and only shows on device, which is the slowest feedback loop |
| B. StyleSheet with a typed token theme | High. No dependency | High for rows. A theme switch re-renders every consumer once | Medium. Clean but hand-rolled | Low |
| C. Unistyles 3 | Medium to high. Almost the StyleSheet API | High. Theme changes cause no re-render (V) | High. Recognised as the current best engine | Medium. Needs a Babel plugin and Nitro modules, which MMKV already brings. Ships Jest mocks (V) |

**Recommendation.** C.
- **Typed tokens.** `tsc` catches token typos.
- **Theme switching.** Changes don't re-render the list.
- **Variants.** Its variants map onto Key, Tag and Stamp.
- **Hex lint.** A lint rule bans raw hex outside the theme file.
- **Fonts.** The upstream Bricolage repo already ships static Condensed ExtraBold cuts (V), so DESIGN.md's font-cutting step goes away. Embed the fonts with the `expo-font` config plugin.

**Would change the call.** Use B if the 30-minute spike shows the Unistyles Babel plugin clashing with Reanimated's worklets or the React Compiler. The style files keep the same shape, so switching is mechanical. Keep A only if you value Tailwind speed over type-checked tokens.

**How to prove it.** Toggle the theme with React DevTools "Highlight updates" on, and History shows no re-render. `tsc` fails on `theme.colors.canvs`.

**Owner pick.**

---

## D9. How are sheets, the add flow and headers built?

| Option | Dev speed | Reviewer signal | Risk | Security |
| --- | --- | --- | --- | --- |
| A. Every sheet and the add flow are routes inside `Stack.Protected`. Add is a modal route group. Confirms and explainers are `formSheet` routes | High | High. Native navigators and native sheets | Low to medium. Android form sheets allow at most 3 detents (V) | High. Locking removes protected routes, so sheets and the add modal close with no extra code (I for sheets) |
| B. Component modals with local `visible` state | Medium | Medium | Medium | Low. A component modal survives the lock, so each needs manual close-on-lock |
| C. `@expo/ui` native controls everywhere | Medium | Mixed. Native but off-brand | Medium. Material segmented buttons can't take the brand's key style (I) | Neutral |

**Recommendation.** A with custom controls.
- **Headers.** Pushed screens use native headers styled with the brand font, which keeps Android predictive back. History draws its own header in the list.
- **Discard guard.** "Discard this draft?" uses `usePreventRemove`, bypassed when the app locks.
- **Native controls.** `@expo/ui` is used only for the date picker, where users expect a native control.

**Would change the call.** If an Android form sheet can't render the paper background edge to edge, or it fights the keyboard, move that one sheet to a modal route.

**How to prove it.**
1. Open the delete sheet and dispatch `LOCK`. Lock shows and the sheet is gone.
2. `adb shell am start -d sen://add` while locked shows Lock.

**Owner pick.**

---

## D10. How is Sen drawn and animated?

| Option | Dev speed | Performance | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. react-native-svg with Reanimated (current) | High. The rig is code that agents can write and diff | Medium to high. SVG props commit each frame, which is fine for one animating Sen with about 12 props (I) | High. A hand-built rig is a craft signal | Low |
| B. Skia | Medium. A new drawing API | High | High | Medium. Overkill for one character |
| C. Rive or Lottie | Low. Agents can't author `.riv` or After Effects files | High | Medium | High. Expo's animation skill says Lottie is for illustration, not UI state, and Sen's eyes are UI state |

**Recommendation.** A, plus three things.
- **MotionDirector.** The pure reducer behind the rule that only one Sen animates. It encodes DESIGN.md's priority rules as a unit-tested table, not a convention.
- **Ambient blink.** Reanimated's CSS animations, which support SVG in 4.4+ (V).
- **Reduced motion.** `ReducedMotionConfig` at the root as a safety net.

**Would change the call.** Switch to B if the Unlock moment drops frames in a release build on a low-end phone.

**How to prove it.**
1. A table test of the director.
2. Mount two Sens, play two moments, and assert only one animates.
3. The Unlock moment holds 55 FPS or better in a release build.

**Owner pick.**

---

## D11. Keep the React Compiler on?

**Context.** The SDK 57 template turns it on (V).

| Option | Dev speed | Scale | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. Keep it on | High. Fewer manual `useCallback` and `useMemo` calls for agents to get wrong | High | High. The modern default | Low to medium. Shared values must use `.get()` and `.set()` (V) |
| B. Turn it off | Medium. More boilerplate | Same if done perfectly | Medium | Low |

**Recommendation.** A.
- **Shared values.** Lint against `.value` on shared values.
- **Hooks.** Destructure functions from hooks.
- **Rows.** Keep an explicit `memo` on list rows.

**Would change the call.** Opt a file out with `'use no memo'` if a worklet misbehaves only when compiled.

**How to prove it.** Run `npx react-compiler-healthcheck` once. DevTools shows memo badges on the row and History.

**Owner pick.**

---

## D12. Where does client state live?

**Context.** The session is a state machine read by React (route guard, list, ring) and by code outside React (AppState listener, idle timer, lock handler).

| Option | Dev speed | Scale (10k) | Reviewer signal | Risk |
| --- | --- | --- | --- | --- |
| A. Typed reducer plus context (current) | High. No dependency | Medium. Every consumer re-renders on every session change | Medium | Medium. Handlers outside React need refs that mirror state, which is the classic stale-closure bug |
| B. Zustand wrapping the same pure reducer | High. 489 B, no dependencies (V) | High. Selectors re-render only what changed | High | Low. Tests need a store reset |
| C. XState v5 | Low. More code per transition | High | High, though some reviewers read it as heavy for five states | Medium. 14.6 KB (V). Its built-in timers are harder to test with a fake clock |
| D. Jotai | Medium | High | Medium | Medium. Spreads one machine across atoms |

**Recommendation.** B. The reducer stays pure and exhaustive. Zustand only replaces the provider. Handlers read `getState()`, rows never subscribe to the session, and screen-local state (search text, filter, draft) stays in `useState`. CLAUDE.md's "no store library" rule changes.

**Would change the call.** If a spike shows no code outside React needs the session, A with split contexts is just as good. If you want the state machine itself to be a showpiece, C, at the cost of about half a day.

**How to prove it.** With 10k rows, a render counter shows zero rows re-render on a step-up flip, and only visible rows re-render on reveal.

**Owner pick.**

---

## D13. Folder structure and how the layers are enforced

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. Current plan. Layer folders at the root, mixed-case file names | High | Medium. Mixed casing looks unconsidered | Medium. Case-only renames break on macOS and Windows checkouts (I) |
| B. Expo's default layout. `src/app`, `screens`, `components`, `hooks`, `utils` | High | Medium. No `services/` or `models/`, which the brief names | Low |
| C. Hybrid. `src/` with the `@/*` alias, kebab-case files and tests next to their files. Routes only in `src/app`. The brief's layers kept: `models/`, `services/`, `features/<name>/`, `components/` | High | High. The brief's words plus current Expo conventions | Low |

**Recommendation.** C, enforced by ESLint alone.
- **Layers.** `import/no-restricted-paths` zones for the layer table.
- **Cycles.** `import/no-cycle`.
- **Deep imports.** Banned across features.
- **Console.** `no-console` everywhere except the logger.

The plugin already ships with `eslint-config-expo` (V), so this adds no packages.

**How to prove it.** Import a service inside a component and run `npx expo lint`. It fails with the zone message.

**Owner pick.**

---

## D14. Which security features earn their place in 3 days?

**Context.** An adversarial review found claims in ARCHITECTURE.md that are stronger than the code can back. A senior reviewer will probe exactly those.

**Weak claims and fixes.**

| # | Claim | Problem | Fix |
| --- | --- | --- | --- |
| W1 | "SecureStore `requireAuthentication` blocks the JS thread" | Wrong. `getItemAsync` doesn't block (V). The real reasons are different. On Android it removes the passcode fallback, and keys die when a fingerprint is added (V) | Correct the reason. Keep the decision |
| W2 | Step-up is a JS boolean | True and admitted. A hooked runtime can skip it | State it plainly in the README |
| W3 | Masking keeps amounts out | True for the screen while masked. Not true for memory while revealed, the share sheet or the accessibility tree while revealed | Narrow the claim. The masked test covers totals too |
| W4 | "The guard re-evaluates on every navigation" | `Stack.Protected` doesn't mount protected routes while locked. It isn't a per-navigation check (V) | Reword |
| W5 | Screenshots blocked app-wide on Android, versus "on sensitive screens" elsewhere | The docs contradict each other. Blocking app-wide also blacks out agent screenshots | App-wide in release only, with a dev toggle. Fix the wording |
| W6 | "An amount can't be logged" | Only true if log metadata is a typed union and `console` is lint-banned | Type the metadata per event code and add the lint rule |
| W7 | Reveal and lock timers use wall-clock time | Winding the clock back extends a reveal (I) | One README line |
| W8 | "Bank data never on disk" | False under D2 | Encrypted at rest (D1) |

**Ranked by reviewer impact over cost.**

| Rank | Control | Call |
| --- | --- | --- |
| 1 | Biometric unlock with every error code mapped, plus the route guard | Build |
| 2 | Masking at the source and the timed reveal, re-masked on background | Build |
| 3 | zod at every boundary, bad rows counted | Build |
| 4 | Face ID step-up on add and delete | Build |
| 5 | Encrypted at rest, key in SecureStore, Android backup off | Build |
| 6 | Screen protection. App-wide FLAG_SECURE in release, iOS switcher blur | Build |
| 7 | Idle lock and re-lock after leaving | Build |
| 8 | Lint-enforced logging rule | Build |
| 9 | Description sanitiser | Build |
| 10 | Custom keypad | Build |
| 11 | Activity log, clear log, erase | Cut first if time runs short |
| 12 | Biometric-bound vault key | README note only |

**Recommendation.** Build ranks 1 to 10 and fix W1 to W8 in the docs. Add a "What this does not protect against" section to the README. A candid threat model earns more from a senior reviewer than a half-built crypto binding.

**Would change the call.** If the reviewers say they will test on a rooted device, build rank 12 by making the SecureStore biometric prompt the unlock itself, and accept losing the passcode fallback on Android.

**How to prove it.**
1. The masked "no digits" test covers totals.
2. Lint fails on a `console.log`.
3. A locked deep link shows Lock.
4. A release-build screenshot of History is black.

**Owner pick.**

---

## D15. How do errors travel?

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. Thrown `Error` subclasses | High | Low to medium. Untyped at call sites | Medium. Message strings drift into the UI |
| B. `Result<T, E>` everywhere via neverthrow | Low. Fights TanStack, which needs rejected promises | Medium. Can read as ceremony | Medium |
| C. Tagged unions. Returned in pure code, thrown at the TanStack seam, typed globally with `Register.defaultError` (V) | High | High. Exhaustive switches with `never` checks | Low |

**Recommendation.** C.
- **Biometric cancel.** A result, not an error.
- **Error boundary.** Every route has one that never renders `error.message`.
- **UI mapping.** Each expected error maps to a designed state, such as an offline banner over the local list or a cool-down card for lockout.

**How to prove it.** Adding a new error kind without handling it fails `tsc`. Each reviewer fault control has a component test.

**Owner pick.**

---

## D16. What do the tests look like?

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. Mostly pure table tests, plus RNTL screen tests through ports with in-memory fakes. Real SQL in Jest through a small `node:sqlite` adapter | High. Milliseconds per test | High. Each security property has a named test | Low |
| B. Component-heavy, `jest.mock` for every native module | Medium. Mocks drift from real behaviour | Medium | Medium. Tests can pass on mocks |
| C. A plus a global 80% coverage gate | Medium. Agents write filler tests | Low to medium | Medium |

**Recommendation.** A.
- **Real SQL.** jest-expo stubs SQLite with no behaviour (V), so a three-method port with a `node:sqlite` adapter lets every query, migration, sync and masking rule run with real SQL in Jest. No emulator is needed. This is the biggest speed lever in the data layer.
- **Coverage.** Thresholds apply to pure modules only.
- **Day-1 check.** expo-router's `renderRouter` was built for RNTL 13, so confirm it works with RNTL 14 (I).

**How to prove it.** Break the mask on purpose and confirm the mask test fails. `npm run check` stays under 30 s.

**Owner pick.**

---

## D17. Which device do agents verify on?

**Machine facts** (V, inspected 2026-10-15).
- **Windows.** An Android 36 emulator image is already installed. WSL networking is mirrored.
- **WSL emulator.** WSL has `/dev/kvm`, but you aren't in the `kvm` group. WSL has no GPU device, so an emulator there would render in software.
- **adb.** Two versions are installed (WSL 37.0.1, Windows 36.0.0). They will fight over the same port.

| Option | Dev speed | Performance numbers | Risk | Biometrics |
| --- | --- | --- | --- | --- |
| A. Emulator on Windows, bridged to WSL | High. Uses the GPU, nothing to download, an agent can boot it | Usable trends | Medium. One-time fix for the adb versions and the console token | `adb emu finger touch 1` drives the real prompt |
| B. Emulator inside WSL | Medium. Needs sudo, a 2 GB download and software rendering | Meaningless | Medium | Same |
| C. Your phone over Tailscale or USB | Medium | The only honest FPS numbers | An unattended agent stalls at every biometric prompt | Real sensor |
| D. EAS Simulator in the cloud | Low. Limited access, costs money, 40-minute sessions on the free plan | Low | High. Experimental commands | Unknown |

**Recommendation.** A for the inner loop. Your phone for the final performance numbers and the demo video. D only for an optional iOS look at the end, if your account has access.

**How to prove it.** Boot the emulator from WSL, `adb devices` lists it, and `npx expo run:android` installs. Edit a string, and a screenshot shows the change in under 5 s (I). `finger touch` passes a test prompt.

**Owner pick.**

---

## D18. What does an agent use to tap and screenshot?

| Option | Dev speed | Risk | Notes |
| --- | --- | --- | --- |
| A. agent-device 0.21.28, plus raw adb for finger touch, deep links and logcat | High. Built for agents. Taps by accessibility label | Low. Pre-1.0, so pin it | Supports local Android from Linux (V) |
| B. Raw adb only | Medium. Agents parse XML and compute coordinates | Low | Always available |
| C. Maestro as an agent tool | Medium | Reviewers may read its YAML flows as the E2E suite you ruled out | |
| D. argent | Unknown on Linux | High | Proprietary binaries |

**Recommendation.** A.
- **Accessibility labels.** Agents tap the same labels a screen reader announces, such as "Amount hidden", so accessibility work doubles as testability.
- **No bypass.** Agents use the real biometric prompt on the emulator. A bypass is the first thing a security reviewer greps for.
- **Screen guard.** It is off by default in dev builds and forced on in release, with a test that proves release always guards. Otherwise every agent screenshot comes out black.

**How to prove it.** Open the app, tap "Continue as demo user", run `finger touch`, and the History header appears in a screenshot that isn't black.

**Owner pick.**

---

## D19. What is the fast loop without a device?

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. Jest, RNTL v14, tsc and lint as one `npm run check` | High. Seconds | High | Low |
| B. A plus Expo web screenshots with Playwright | Medium. Needs web fallbacks for SecureStore, biometrics and screen capture | Low to negative. Web shims in a mobile security app | Medium. Layout differs on web |
| C. A plus a dev-only states gallery route | High. One deep link per state | High. It forces screens to take view models | Low, if it's gated out of release |

**Recommendation.** C on top of A. Skip Expo web. A link such as `sen://dev/states?screen=history&state=offline` renders one state from fixtures for a screenshot. RNTL tests use the same fixtures. The route is guarded by `__DEV__`, and a release check shows the link landing on Lock.

**Owner pick.**

---

## D20. How do we prove the list is fast at 10k rows?

**Recommendation.** Jest benches run in CI as the gate. Flashlight runs on release builds at milestones. React DevTools is for diagnosis only. These budgets are proposals until measured.

| Metric | Budget | Tool |
| --- | --- | --- |
| Scroll FPS over 10 s of flings, release build | 55 or more | Flashlight |
| Unlock to first list paint | 500 ms or less | `performance.measure` |
| Search, keystroke to result, 10k rows | 100 ms or less at p95 | Device mark, plus a Jest bench of 16 ms or less on Node |
| Group, filter and mask on 10k rows | 16 ms or less each on Node | Jest bench |

**Would change the call.** If emulator FPS swings by more than 10 between identical runs, gate only on your phone.

**Owner pick.**

---

## D21. Git and CI on master only

| Option | Dev speed | Reviewer signal | Risk |
| --- | --- | --- | --- |
| A. CI only (GitHub Actions running tsc, lint and jest on push) | High | High. A green check on every commit | Medium. Broken commits land, then get fixed |
| B. A plus a zero-dependency pre-commit hook (`.githooks/`, typecheck plus related tests) | Medium to high. About 10 to 20 s per commit (I) | High. "Every commit builds" is enforced | Low |
| C. Neither | Highest | Low | High |

**Recommendation.** B.
- **Messages.** Short, as `type: what changed`. No attribution lines.
- **Parallel agents.** Each works in its own local worktree. The coordinator runs the checks and fast-forwards master. Only master is ever pushed, and history stays linear.

**Would change the call.** If the hook passes 30 s, keep only `tsc` in it.

**Owner pick.**

---

## D22. In what order do we build?

| Option | Dev speed | Risk |
| --- | --- | --- |
| A. One agent, strictly serial | Low | Low |
| B. Serial scaffold and contracts, then parallel lanes on separate folders | High | Medium. Integration bugs at merge |
| C. Vertical slices, one agent per screen | Medium | High. Every slice edits shared files, and security gets bolted on |

**Recommendation.** B. The phases, lanes and checks are in [PLAN.md](PLAN.md). The scaffold installs every dependency up front, so no lane touches `package.json`.

**Owner pick.**
