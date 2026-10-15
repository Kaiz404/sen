# Sen architecture

How Sen is built. It follows the decisions in [DECISIONS.md](DECISIONS.md), made on 2026-10-15. No code exists yet, so every path below is the plan. Claims marked **V** were verified against a primary source on 2026-10-14 or 2026-10-15. Claims marked **I** are inferred.

Sen is a frontend-only, local-first app. The "bank" is an in-app mock service that syncs into an encrypted on-device database. It is built for 10,000 transactions. The brief is titled "Secure Transaction History Module", so security is the organising idea. Every layer has a security job.

## Stack

Expo SDK 57 (`expo@57.0.28`), React Native 0.86.3 on the New Architecture, React 19, TypeScript ~6.0.3 with `strict: true`, React Compiler on.
- **Scaffold.** `npx create-expo-app --template default@sdk-57`.
- **Installs.** Every Expo package goes in with `npx expo install` so versions match the SDK.
- **Bundled versions.** From https://unpkg.com/expo@57.0.28/bundledNativeModules.json (V).

| Need | Package | Version | Notes |
| --- | --- | --- | --- |
| Navigation | `expo-router` | ~57.0.26 | Native stack, `Stack.Protected`, form sheets as routes (D9) |
| Database | `expo-sqlite` with `useSQLCipher` | ~57.0.4 | Encrypted at rest (D1) |
| Preferences | `react-native-mmkv` + `react-native-nitro-modules` | 4.3.x / ≥ 0.37.1 | Not sensitive. Synchronous read for the theme |
| Styling | `react-native-unistyles` | 3.x | Typed tokens, theme switch without re-renders (D8) |
| List | `@shopify/flash-list` | 2.3.3, pinned | Excluded from `expo install --check` (D7) |
| Client state | `zustand` | 5.x | Wraps the pure session reducer (D12) |
| Async state | `@tanstack/react-query` | 5.104.x | Reads SQL, runs sync and mutations (D2) |
| Validation | `zod` | 4.6.x | Parse at every boundary. v4 issues carry no input by default (V) |
| Biometrics | `expo-local-authentication` | ~57.0.3 | `biometricsSecurityLevel: 'strong'` (Android only, V) |
| Database key | `expo-secure-store` | ~57.0.4 | Keychain or Keystore |
| Secure random | `expo-crypto` | ~57.0.4 | `getRandomValues` and `randomUUID`. Never `getRandomBytes`, which uses `Math.random` in development (V) |
| Screen guard | `expo-screen-capture` | ~57.0.4 | FLAG_SECURE on Android, switcher protection on iOS |
| Network | `expo-network` | SDK 57 | Offline banner, `onlineManager` for sync |
| Animation | `react-native-reanimated` + `react-native-worklets` | 4.5.1 / 0.10.1 | The bundled versions |
| Gestures | `react-native-gesture-handler` | ~2.32.0 | Root wrapped in `GestureHandlerRootView` |
| Drawing | `react-native-svg` | 15.15.4 | Sen |
| Haptics | `expo-haptics` | ~57.0.3 | `performAndroidHapticsAsync` on Android |
| Fonts | `expo-font` config plugin | | Static Bricolage Condensed ExtraBold and ExtraBold cuts from upstream, IBM Plex Mono |
| Icons | `@expo/vector-icons` (MaterialCommunityIcons) | ^15 | |
| Formatting | `Intl` on Hermes | | Add the +/− sign by hand. Money is integer sen |
| Tests | `jest-expo` + `@testing-library/react-native` | ~57.0.6 / 14.1.x | RNTL v14 is async and needs Node ≥ 22.13 |
| Lint | ESLint 9 flat + `eslint-config-expo` + Prettier 3 | | Layer zones, no-cycle, no-console, raw-hex ban, `.value` ban, `useReducedMotion` ban, `runOnJS` ban, `'cubic-bezier('` string ban |
| Device checks | Maestro CLI | 2.11.x | Flows, `assertScreenshot` baselines and `startRecording` videos for agent verification. Not a shipped E2E suite |

**Skipped on purpose.** The reasons are in DECISIONS.md.

| Option | Decision |
| --- | --- |
| MMKV vault for transactions | D1 |
| op-sqlite, TinyBase, Legend State | D1 |
| SectionList, Legend List | D7 |
| Uniwind, NativeWind | D8 |
| XState, Jotai, Redux | D12 |
| Skia, Rive, Lottie | D10 |
| `react-native-biometrics`, `react-native-keychain` | Unmaintained, or needs a backend to mean anything |
| Sentry, Storybook, i18n | No account to show, costly to set up, one locale |
| agent-device, Detox, Storybook, Expo web | D18, D19 |
| Expo Go | Can't run SQLCipher or MMKV. Face ID doesn't work in it on iOS |

## Layers

```
 ┌──────────── src/app/ (routes, thin) ──────────────────────────┐
 │ _layout.tsx: Stack.Protected guard={unlocked}                 │
 │ lock  welcome  (index)  transaction/[id]  add/  settings/     │
 │ (dev)/states   (guard={__DEV__})                              │
 └───────────────▲───────────────────────────────────────────────┘
                 │ view models. amount is null while masked
 ┌───────────────┴──────── src/features/ ────────────────────────┐
 │ auth/          session reducer + store, step-up, locks, cover │
 │ transactions/  history list, reveal, search, filters          │
 │ detail/        detail screen, share, copy                     │
 │ add/           draft reducer (memory only), keypad, review    │
 │ settings/      preferences, reviewer controls                 │
 │ security/      screen guard, activity log, erase              │
 │ sen/           mascot rig, poses, timelines, MotionDirector   │
 └───────▲──────────────────────▲────────────────────────────────┘
         │ typed domain objects │
 ┌───────┴──────── src/services/ ───┴────────────────────────────┐
 │ db (port + adapters)  tx-repo  sync  bank-api (mock + seed)   │
 │ db-key  prefs  clock  crypto  sanitize  logger  haptics       │
 └──▲───────────────▲───────────────▲───────────────▲────────────┘
  ══╪═══ TRUST BOUNDARY: everything below is untrusted ════════════
    │ PARSE (zod)   │ PARSE (zod)   │ KEY          │ PARSE (zod)
 mock bank pages  SQLCipher DB    SecureStore     MMKV "prefs"
 (seeded)         sen.db          db key          theme, timers
```

| Layer | Owns | Imports |
| --- | --- | --- |
| `src/models/` | zod schemas, inferred types, money helpers | Nothing |
| `src/services/` | All I/O. Nothing unparsed leaves this layer | `models/` |
| `src/theme/` | Unistyles themes and tokens | Nothing |
| `src/motion/` | Motion tokens, policy, timeline helpers | `theme/` |
| `src/features/` | Domain logic, hooks and screens per feature | `services/`, `models/`, `components/`, `theme/`, `motion/` |
| `src/components/` | Design-system primitives: `Amount`, `Key`, `ReceiptSlip`, `Stamp`, `Tag`, `Segmented`, `Toast` | `models/`, `theme/`, `motion/` |
| `src/app/` | expo-router routes only. Each renders a feature screen | `features/`, `components/`, `theme/`, `motion/` |

**Enforcement.** ESLint zones enforce this table, plus `import/no-cycle`. Deep imports across features are banned, and so is `console` outside `services/logger.ts`. File names are kebab-case and tests sit next to their files. Route tests are the exception. Expo Router bundles every file in `src/app/` as a route, so they live in `src/__tests__/`, and lint fails on a test file inside `src/app/`. The alias is `@/*` for `src/*`.

## Models

```ts
type Transaction = {
  id: string
  amountMinor: number            // integer sen, never a float
  currency: 'MYR'
  type: 'debit' | 'credit'
  description: string
  merchant: string
  category: CategoryId
  status: 'posted' | 'pending'
  postedAt: string               // ISO 8601, UTC
  reference: string
  account: { name: string; last4: string }
  source: 'bank' | 'manual'      // bank rows are read-only
}

type MaskedRow = Omit<Transaction, 'amountMinor'>   // what masked queries return
type AppError =
  | { kind: 'offline' } | { kind: 'timeout' } | { kind: 'server' }
  | { kind: 'invalid_data'; skipped: number }
  | { kind: 'db_reset'; reason: 'missing_key' | 'corrupt' }
```

Each model is a zod schema with its type inferred from it. There is no barrel. Callers import the file, such as `@/models/money`.

| File | Holds |
| --- | --- |
| `money.ts` | `Minor` (a non-negative integer of sen, what `amountMinor` holds) and `SignedMinor` (credits positive). `signed(amount, type)` is the one place a direction becomes a sign. `moneyParts`, `moneyText` and `moneySpoken` take a `SignedMinor` and a `SignMode` (`'auto'` or `'never'`) |
| `day.ts` | `Instant` (UTC, fixed width with milliseconds) and `DayKey` (a Malaysia-time day). `malaysiaDay()` equals SQL `date(posted_at, '+8 hours')` |
| `category.ts` | Ten categories for bank rows. `ADD_CATEGORIES` holds the eight add chips |
| `transaction.ts` | `TransactionSchema`, the strict `MaskedRowSchema` (a selected amount fails the parse), and `TransactionPageSchema` for the mock bank's `{ items, nextSeq }` envelope |
| `draft.ts` | `DRAFT_LIMITS`, `draftSchema(today)` and the 90-day add window |
| `errors.ts` | `AppError`, `isAppError`, `isRetryable`, and `Result` as `{ ok: true; data } \| { ok: false; error }`. It uses `data` because lint bans `.value` |
| `prefs.ts` | `PREFS`, every MMKV key from DESIGN.md › Settings with its schema and default. `parsePref` never throws and falls back to the default |

Money output:

| Call | Result |
| --- | --- |
| `moneyParts(-231740)` | `{ sign: '−', currency: 'RM', whole: '2,317', fraction: '.40' }` |
| `moneyText(-4250)` | `−RM 42.50`, with U+2212 and a thin space after RM |
| `moneySpoken(-4250)` | `Minus 42 ringgit 50`. Digits stay ungrouped so no screen reader says "comma" |

## Data layer

**Database.**
- **The file.** One SQLCipher file, `sen.db`. Its tables are `tx`, `sync_state`, `activity_log` and `meta`.
- **Columns.** `tx` stores `posted_at` in UTC and a `day` column in Malaysia time (UTC+8). Its covering index is `(posted_at desc, id desc)`. `search_text` is lowercased and stripped of accents at write time.
- **Migrations.** `MIGRATIONS` in `services/db/schema.ts` is an append-only ladder of `{ version, statements }`. Each step runs its statements one at a time, because node:sqlite prepares one statement per call, and ends with `PRAGMA user_version = n`, all in one transaction. A failed step leaves the previous version. Running `migrate` again is a no-op. A file newer than the app throws `SchemaTooNewError`, which the caller resets as `db_reset`.
- **The port.** The database sits behind a three-method port (`all`, `run`, `transaction`). The app uses the expo-sqlite adapter. Jest uses a `node:sqlite` adapter, so every query runs real SQL in tests (V, jest-expo stubs SQLite with no behaviour).

**Port semantics** (`services/db/port.ts`, proven in `port.test.ts` on real SQL).
- **One implementation.** Each adapter supplies a `Driver` (`all`, `run`, `close`). `createDb(driver)` adds the queue, transactions and savepoints once, so Jest runs the device semantics.
- **FIFO.** Calls on a handle run in order, one at a time. A root call made while a root transaction is open waits until it settles, so it never lands inside it.
- **Transactions.** On the root handle, `transaction(work)` is `BEGIN IMMEDIATE`, then `COMMIT`, or `ROLLBACK` and rethrow. On a `tx` it is a `SAVEPOINT`, so a helper written as `(db: Db, …)` runs alone or inside a caller's transaction, and a failed savepoint undoes only its own writes.
- **One rule.** Inside `work`, use only `tx`. A call on the outer handle waits for `work` and never returns. A `tx` used after its scope rejects. Services take `db` as a parameter and never hold one at module scope.
- **Rows.** `all` returns untrusted `SqlRow`s. `parseRows(rows, schema)` in `services/db/rows.ts` maps snake_case columns to the model shape (`account_*` folds into `account`) and parses each row, returning `{ rows, skipped }`. A masked query that selects `amount_minor` fails the strict `MaskedRowSchema`, so the bug is loud.
- **Tests.** `openTestDb()` from `services/db/testing/` gives a fresh, migrated `:memory:` database. `createNodeDb()` gives one at version 0.
- **The device adapter.** `openDb(key)` in `services/db/expo.ts` opens `sen.db`, runs `PRAGMA key = "x'<hex>'"` as the first statement, proves the key with one read (`DbUnreadableError` on failure) and migrates. `DbKey` is a zod brand that only accepts 64 hex characters, because the key is the one string interpolated into SQL.
- **Never `withExclusiveTransactionAsync`.** It opens a second native connection without the SQLCipher key. `db.transaction` gives the same isolation on the one keyed connection. Lint bans the call.

**Schema v1.**

| Table | Holds | Guards |
| --- | --- | --- |
| `tx` | Bank and added rows | `STRICT`, so a float amount is refused. `amount_minor > 0`. `posted_at` must match `YYYY-MM-DDTHH:MM:SS.mmmZ`, so text order is time order. `day` is `GENERATED ALWAYS AS (date(posted_at, '+8 hours')) STORED`. `idem_key` is `UNIQUE` and set only on manual rows. `category` is unchecked, so a bad row reaches zod and is counted |
| `sync_state` | One row: the bank cursor and the last sync time | `id = 1` |
| `activity_log` | Security events | `meta` must be valid JSON. The `activity_log_cap` trigger keeps the newest 50 rows |
| `meta` | Key-value app state | `STRICT` |

Indexes: `tx_by_time (posted_at DESC, id DESC)`, which the keyset page query reads as a covering index, and `activity_log_by_time (at DESC, id DESC)`.

**Sync (D2).**
- **Cursor.** The mock bank serves pages ordered by a `seq` cursor.
- **Upsert.** `sync()` parses each page with zod and upserts it in one transaction (`INSERT … ON CONFLICT(id) DO UPDATE`). A retried or interrupted sync ends in the same state.
- **Seed (D5).** A seeded generator (mulberry32) feeds the mock bank. The first 20 rows match the design boards. Sizes are 20, 1k (the default) and 10k.
- **Reviewer faults.** Forced `offline`, `timeout`, `server` and bad rows hit the real sync path.
- **Pull-to-refresh.** Runs `sync()` through a TanStack mutation. Retries cover `offline`, `timeout` and `server` once, never `invalid_data`.

**Reads (D3, D4).**
- **Pages.** `useInfiniteQuery` loads keyset pages of 100 into FlashList.
- **Totals.** The month card and day nets are plain `SUM … GROUP BY day` queries over the loaded date range.
- **Search.** `LIKE` on `search_text`, with `%` and `_` escaped, and the input debounced with `useDeferredValue`.
- **Freshness.** The one write module calls `invalidateQueries(['tx'])` after every commit.

**Masking (D6).**
- **Masked queries.** They return `MaskedRow` and never select `amount_minor`. Masked totals return counts only.
- **On reveal.** One query loads `id → amountMinor` for the loaded range, keyed `['tx','revealed',…]`. Rows read it through `useAmountView(id)`, which returns `null` while masked. The list's `data` never changes on reveal.
- **On re-mask.** `removeQueries(['tx','revealed'])`.
- **Honest limit.** While revealed, amounts sit in JS memory. While masked, no amount exists in JS.

## State

**Session.**
- **Reducer.** A pure reducer in `features/auth/machine.ts`, a discriminated union with an exhaustive `switch` and no timers.
- **Store.** A Zustand store wraps it.
- **React.** Components select narrow slices. Rows never subscribe to the session.
- **Outside React.** Handlers such as AppState, the idle tick and lock call `store.getState()`.

**Screen-local state.** Search text, filter and the add draft stay in `useState` or `useReducer` in their screen. The draft lives in memory only.

```
            UNLOCK_OK                    REVEAL_OK
 locked ─────────────► unlocked ───────────────────► revealed{until}
   ▲  ▲ AUTH_FAIL/       │  ▲      REVEAL_EXPIRED,    │
   │  └─ CANCEL ◄─ authenticating   HIDE, BACKGROUND  │
   │                     │  └─────────────────────────┘
   │ LOCK (idle, background past window, Lock now)    │
   └─────────────────────┴────────────────────────────┘
```

| State | Holds | Routes allowed |
| --- | --- | --- |
| `locked` | `reason`: launch, idle, background, manual, signout | `lock`, welcome, primer |
| `authenticating` | `purpose`: unlock or a step-up action | Current screen stays |
| `unlocked` | `since` | All protected routes, amounts masked |
| `revealed` | `until` (epoch ms) | Same, amounts shown |
| `stepUp` | `action`, `returnTo` | Current screen stays |

**Step-up.** `useStepUp(action)` returns `{ ok: true } | { ok: false; reason }`. It is never cached, so every write prompts.

| Action | Prompt | On success | On cancel |
| --- | --- | --- | --- |
| `reveal` | "Reveal amounts" | `revealed{until: now + revealSeconds}` | Stay masked, silently |
| `add` | "Save this transaction" | DB write, log `tx.added` | "Not saved. Your draft is still here." |
| `delete` | "Delete this transaction" | DB delete, log `tx.deleted` | Sheet stays |
| `clearLog` | "Clear security activity" | Log cleared, one `log.cleared` entry left | Nothing |
| `erase` | "Erase transactions you added" | Manual rows deleted, log `data.erased` | Nothing |

Undo inside the 6 s toast skips the prompt. It only reverts what the user just authorised, and it is logged.

**`authenticateAsync` options.**
- `biometricsSecurityLevel: 'strong'`.
- `disableDeviceFallback: false`.
- A ref guard blocks a second prompt while one is open.

How the first two combine on a phone with only weak biometrics isn't documented, so it gets tested on a device.

**Error codes**

| Codes | Meaning | UI |
| --- | --- | --- |
| `user_cancel`, `system_cancel`, `app_cancel` | Cancelled | Return silently. Not an error |
| `authentication_failed` | No match | Inline message, retry |
| `lockout` | Locked out | Cool-down card, device passcode |
| `not_enrolled`, `passcode_not_set` | Not set up | Explain, open device settings, passcode |
| `not_available` | No hardware | Explain, passcode |
| `user_fallback` | Chose passcode | Continue with fallback |
| Anything else | Unknown | Generic retry |

**Lock triggers**

| Trigger | Mechanism |
| --- | --- |
| Background | AppState `background` re-masks at once and stores `backgroundedAt` |
| Return | On `active`, lock if `now − backgroundedAt > relockAfter`. Never auto-prompt |
| Idle | `onTouchStart` on the root resets `lastTouch`, a plain module variable. A 15 s tick compares it with `idleLock` and pauses in background |
| Reveal expiry | The same tick compares with `until`. The ring animates on the UI thread |
| Manual | "Lock now" |

**The iOS inactive trap.** The Face ID sheet itself sends the app to `inactive` and back. So:
- `isAuthenticatingRef` is set before the prompt and cleared in `finally`.
- Only `background` locks or re-masks. `inactive` only shows the privacy cover.
- The reducer ignores `BACKGROUND` while in `authenticating` or `stepUp`.

**On `LOCK`:**
- `queryClient.clear()`.
- Close the database.
- Drop the draft.
- Re-mask.

Protected routes, which include every sheet and the add flow, are unmounted. A deep link that arrives while locked lands on Lock and is not replayed after unlock.

## Errors (D15)

**Tagged unions.**
- Pure and service code returns a small local `Result`.
- `queryFn` and `mutationFn` throw the tagged value.
- `Register.defaultError` types `error` as `AppError` everywhere.

**Unexpected bugs.** They reach a route `ErrorBoundary` that shows Sen and a retry and never renders `error.message`.

| Source | Kind | UI |
| --- | --- | --- |
| Sync, no local rows | `offline`, `timeout`, `server` | Full error card with Retry |
| Sync, local rows exist | `offline` | Calm banner over the list with the last sync time |
| Sync, local rows exist | `timeout`, `server` | Banner, list kept, Retry |
| Sync | `invalid_data` | List shown, "2 items couldn't be read" |
| Database | `db_reset` | One-time notice |

## Storage and keys

| Store | Holds | Protection |
| --- | --- | --- |
| `sen.db` (SQLCipher) | Bank rows, added rows, sync cursor, activity log | AES-256, whole file |
| SecureStore `sen.dbKey.v1` | 32 random bytes as 64 hex characters, applied as a raw key (`PRAGMA key = "x'…'"`) so open skips PBKDF2 (V) | Keychain or Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| MMKV `prefs` | theme, `revealSeconds`, `idleLock`, `relockAfter`, `senMotion`, `haptics`, `demo.*` | None. Nothing sensitive |

**Key.** Generated with `getRandomValues`. It is readable only while the phone is unlocked and is never restored to another device (V).

**Why not `requireAuthentication`.** It would bind the key to biometrics. It is skipped for three reasons (V, expo-secure-store 57.0.4 source):
- On Android, it prompts with `BIOMETRIC_STRONG` only and offers no passcode fallback.
- Keys die when biometrics change, so enrolling a fingerprint would destroy the user's data.
- It doubles the prompt.

The biometric gate is therefore the JS step-up. The README states this limit.

**Lifecycle**

| Event | What happens |
| --- | --- |
| First unlock | Generate and store the key, create the database, run migrations, first sync |
| Unlock | Read the key, open the database |
| Lock | Close the database. Clear the query cache |
| Sign out | Delete the key, `deleteDatabaseAsync`, `prefs.clearAll()` |
| Erase | Step-up, then delete manual rows and log it |
| Key missing, database present | Backup restore or reinstall. Unreadable by design. Delete it, start clean, show `db_reset` |
| Database unreadable | Same |
| One bad row | Drop it, count it, show "1 item couldn't be read" |

**Activity log.**
- At most 50 rows `{ id, at, code, meta }`.
- `meta` is a typed union per `code` with no amount field, so an amount can't be logged.
- Sign-out destroys the log with the database.

**Backups.**
- **Android.** `android.allowBackup: false` (its default is `true`, V).
- **iOS.** A restored database has no key, because the key is `THIS_DEVICE_ONLY`. So it is reset on first unlock (I).

## Add form input

| Field | Rule | Where |
| --- | --- | --- |
| Amount | Integer sen, 1 to 5,000,000 (RM 0.01 to RM 50,000.00) | `models/draft.ts` |
| Keypad | Digits shift in from the right. At most 7 digits. No decimal key | `features/add/keypad-reducer.ts` |
| Direction | `'debit' \| 'credit'`. The sign is never typed | `models/draft.ts` |
| Description | Cleaned, then 2 to 60 characters. NFC, control, zero-width and bidi characters removed, spaces collapsed, trimmed | `services/sanitize.ts` |
| Description input | `autoCorrect={false}`, `autoComplete="off"`, `spellCheck={false}`, `textContentType="none"`, `importantForAutofill="no"` | `features/add/details-step.tsx` |
| Category | Enum of eight | `models/category.ts` |
| Date | Today back to 90 days. Never future | `models/draft.ts` |

**Why a custom keypad.** No amount ever reaches a keyboard that learns, suggests or syncs. The input space is exactly ten digits and delete.

**Double submit.**
- **Draft key.** The draft gets an `idemKey` from `randomUUID()`, stored in a `UNIQUE` column, so a repeat save returns the existing row.
- **Save key.** It disables before the prompt.

## Motion

Sen and every animated component follow one model. Motion is data, compiled to Reanimated, and checked the way Reanimated's docs and large open-source apps check it. The decisions are D23 to D26 in DECISIONS.md. The patterns below were proven in three Jest spikes on SDK 57 (Reanimated 4.5.1, worklets 0.10.1, react-native-svg 15.15.4, RNTL 14.1) unless marked I.

### Sen's rig

**Channels.**
- Every value Sen can animate is a named numeric channel, about 40 in all: body (`mv.x`, `sq.r`, `sp.th` and so on), face slide (`lk.x`, `lk.y`), eyes, six mouth opacities, cheeks, paws and props.
- There are 41: rig.md's 39 plus `eyeL.dy` and `eyeR.dy`, because kit.py's worried eyes drop by 8.
- A `Frame` is a full record of channels. `REST` is derived from `CHANNELS` and the set that rests at 1.
- A pose is a `PoseSpec` written the way kit.py writes it: one eyes kind, one mouth, at most one prop, the face offset, the lean (`sq.r` about (10, 278)) and the paws. `poseFrame(pose, prop?)` expands it into a full `Frame`. A spec can't name two mouths.
- Discrete choices are opacity channels. Exactly one mouth is at 1 and each eye is in exactly one state, and a test checks every pose with every prop.

| Node | Kind | Notes |
| --- | --- | --- |
| `mv`, `rl`, `sq`, `sp` | Four nested `Animated.View`s | Static `transformOrigin` for the pivots (coin centre, contact point). These take Reanimated's fast native path on Android |
| Rim, face disc | Static SVG | |
| Clip `G` | Static | Never animated, so the face can slide behind the rim while the clip stays put |
| `lk`, eyes, paws | `AnimatedG` with a `matrix` computed in a worklet (`mat(tx, ty, r, sx, sy, ox, oy)`) | RNSVG native accepts only `matrix`, not `translateX` or `originX` (V, source). This avoids the pivot bug |
| Eye open, shut, happy. Mouths. Cheeks. Props | `AnimatedG` or `AnimatedEllipse` opacity | One channel per node, so idle nodes do no work |
| Accents | Separate `SenAccents` layer | Mounted only while they play |

- **One public `<Sen>`.**
  - Without an `id` it renders `SenStatic`, a memoised pure render of a pose with no Reanimated hooks. That covers headers, toasts and the app-switcher cover. Under 48 pt it draws face and eyes only.
  - With an `id` it renders `SenRig`, which registers with the director.
- **Shared node code.** Both render from the same node functions (`art/nodes.ts`), so the static and animated drawings can't drift.
  - `NODES` gives each part its declared channels and a worklet `read(frame, unit)`. A test calls each `read` through a recording Proxy and checks it reads exactly its channels, because a mapper wakes for every shared value it captures.
  - `SVG_TREE` holds nesting and draw order as data. Eyes and mouths ride in `lk`, and `lk` sits inside the static clip. Held props sit in `pawR`. The nightcap and shades sit above the clip and outside `lk`. `treeFor(tier)` drops mouths, cheeks, paws and held props at the face tier.
  - Geometry in `art/geometry.ts` is copied from kit.py, and the tails face and edge pill from MAX-Library. The edge pill sits outside `sp`, so the rig draws it in its own layer.
- **Never in a row.** Sen never goes inside a FlashList row.
- **Viewbox.** The Svg uses a 680-unit box so raised paws and tilts aren't clipped.

### Moments as data

```ts
type Step = { at: number; v: number; ease?: Ease } | { at: number; v: number; spring: SpringName };
type Track = { ch: Channel; steps: readonly Step[]; flourish?: true };   // flourish is dropped in Calm
type Moment = { id: MomentId; priority: 0 | 1 | 2 | 3; from: PoseId; to: PoseId; dur: number;
                tracks: readonly Track[]; marks: readonly { at: number; haptic?: HapticKind; accents?: true }[];
                loop?: true };
```

- **Compiler.** `compileTrack` turns a track into `withSequence`, `withDelay`, `withTiming` and `withSpring` on that channel's shared value.
- **Sampler.** `sampleTrack(track, ms)` is a pure function that returns the value at a time. The pose gallery uses it to draw settled poses. Tests don't use it as their oracle. They assert literal values copied once from DESIGN.md, so a wrong spec can't agree with itself.
- **Generated tracks.** The Euler wobble and the edge spin come from generators (`eulerSteps`, `edgeSpin`).
- **Marks.** Haptics and accents fire from a per-rig clock shared value through `scheduleOnRN`. They stay in step with the UI thread. `runOnJS` is deprecated.
- **Easing.** Every easing uses the canvas curves as `Easing.bezier`: out `.2,.8,.2,1`, sine `.37,0,.63,1`, inQ `.55,.085,.68,.53` and outQ `.25,.46,.45,.94`. The board and the app then draw the same curve.
- **No CSS animation in the rig.** Reanimated CSS animations can't drive SVG group transforms, ignore reduced motion, and can't be seen in Jest. Ambient loops (blink, peek, breathe) use the same compiler with `withRepeat`.

### MotionDirector

A pure reducer in a Zustand store. It never touches shared values. It emits commands that a small runner applies through each rig's handle (`play`, `cancel`).

```ts
type DirectorEvent = register | unregister | { type: 'request'; sen; moment } | { type: 'finished'; token }
                   | { type: 'gate'; patch: Partial<{ scroll; focused; appActive }> } | { type: 'level'; level };
type Command = { type: 'play'; sen; moment; token; level } | { type: 'cancel'; sen; settleTo: PoseId };
export function direct(s: DirectorState, e: DirectorEvent): [DirectorState, Command[]];
```

- **Priority.** A higher priority cancels a lower one, and the cancelled Sen settles to that moment's end pose. An equal priority queues one, and a newer request replaces it. P0 is dropped.
- **Stale finishes.** A `finished` with an old token is ignored, which guards the race with a cancelled sequence.
- **Gates.**
  - A closed gate cancels into the end pose. The gates are scroll, unfocused and app inactive.
  - Pull-to-refresh is direct manipulation, so the scroll gate never blocks it.
  - The idle scheduler is a JS timer with injected `random` and `now`.

### Motion levels

- **`useMotionPolicy()`.** Resolves `full`, `calm` or `off` from the "Sen's animations" setting and the system setting. System reduce turns Full into Calm.
- **Live system setting.** It reads `AccessibilityInfo.isReduceMotionEnabled()` plus its change listener. Reanimated's `useReducedMotion()` is read once at import and never updates (V). Lint bans it.
- **Calm.** It is compiled from the data. Flourish tracks such as hops, spins, flips and accents are dropped, and pose changes become 150 ms timings marked `ReduceMotion.Never`. Reanimated's own reduced motion would jump straight to the end (V).
- **Off.** Poses snap and haptics still fire.
- **`<MotionPolicyRoot>`.** Sets `ReducedMotionConfig` to `Never` in Full and `Always` otherwise. It is the live switch for every other worklet animation.
- **Plumbing.** `src/motion/` can't import services, so the root layout reads the setting through `useSenMotionPreference()` from `@/features/settings` and passes it to `<MotionPolicyRoot preference>`. Without a root, as in a component test, `useMotionPolicy()` returns `'full'`.
- **CSS transitions.** They ignore reduced motion (V), so components set their duration to 0 from the policy.
- **Informational timers.** The countdown ring keeps running in every mode, using `ReduceMotion.Never`.

### Animated components

Shared primitives are built once, so no agent re-implements a pattern.

| Component | How it moves | Thread and renders | Test |
| --- | --- | --- | --- |
| Amount reveal | `<RevealProgressProvider>` holds one shared value. Each digit column has a `useAnimatedStyle` (`digitStyle(p, col)`) | UI. About 20 mounted rows render once when the amounts map arrives, then zero during the roll. The spike measured zero parent re-renders | `toHaveAnimatedStyle` at 100 ms. Commit counter |
| Countdown ring and label | `useCountdownProgress(deadline)` with a linear `withTiming` and `ReduceMotion.Never`. The ring's offset is a pure `ringOffset()`. The label is a 1 Hz `useSecondsLeft`. `useRevealPhase` flips to `ending` at 10 s | UI ring. Only the label renders, once a second. Rows never subscribe | Pure maths test. Fake clock: `0:10 LEFT` at 50 s |
| Press keys | Gesture Handler `Pressable` (immune to the Android fast-path press bug, V). The face slides 4 px onto a static ink shadow plate with a 90 ms CSS transition. No shadow animates | UI after one render | `pressIn` gives `translateY: 4` |
| Segmented control | Absolute pill with a CSS transition on percent `translateX`. Nothing to measure | UI | Press "In" gives `translateX: '100%'` |
| New row slide-in | `<EnterOnce>` mounts only for the just-added id, set by a store flag cleared at 900 ms. Recycled cells never replay it | UI | The wrapper exists for that id only |
| Toasts, offline banner | One `<ToastHost>` at the root with module-level `FadeInDown` and `FadeOutDown`, keyed by id | UI | Undo works. Gone after 6000 ms |
| Pull-to-refresh | Phase 1 is FlashList `refreshing` with Sen in an overlay slot. Phase 2, optional on Android, is a `Gesture.Pan` plus `Gesture.Native` with a `pull` shared value and `useThreshold` for the haptic | UI | `fireEvent(list, 'refresh')` calls the sync |
| Skeleton | `<Bone>` with one CSS keyframe band, 1.4 s linear | UI, no renders | Pure `bandStyle(policy)` test |
| Launch | One loop clock, `useLoopClock(4800)`. Letters, drop and fade all derive from it through `kf(t, stops, values)`. Hands off to Sen's rig. The native splash is plain ink, hidden on first layout | UI, zero renders | Fake timers at key times |
| Theme switch | Unistyles, instant, no re-render | Native | Device render counter |
| Privacy cover | iOS: a plain conditional cover on `inactive`, no enter animation. Android: FLAG_SECURE, because Android never emits `inactive` (V) | | iOS: RNTL. Android: recents screenshot |
| Sheets, modal, pushes | Native stack. Fade in Calm and Off | Native | Device only |

Files: `src/motion/` holds `tokens.ts` (easing, springs, durations, `cubicBezier` CSS ports), `policy.tsx`, `countdown.ts` (`useSecondsLeft`, `useCountdownProgress`, `ringOffset`, `useRevealPhase`), `threshold.ts` (`useThreshold`) and `timeline.ts` (`kf`, and `useLoopClock`, a read-only clock derived from one linear run so laps never lose a frame). The components (`key`, `segmented`, `enter-once`, `skeleton`, `toast`, `countdown`) live in `src/components/`. Sen lives in `src/features/sen/` (`art/`, `channels.ts`, `poses.ts`, `timeline/`, `moments/`, `director/`, `components/`).

### Proving motion works

This follows what Reanimated's docs and large open-source apps actually do. A survey covered 15 projects, among them Expensify, Bluesky, Rainbow, Mattermost, React Navigation, FlashList and Reanimated itself.
- **Jest.** It checks values at chosen times.
- **Pure functions.** Motion maths lives in plain functions tested with literal numbers.
- **Maestro.** Flows and screenshots cover settled screens.
- **By eye.** Motion quality and smoothness are judged on a release build on a real phone.

No surveyed app pixel-tests frames mid-animation or gates animation FPS in CI, so Sen doesn't either.

**Jest setup** (V, spike, and the same as Reanimated's own tests).

```js
// jest.config.js: preset 'jest-expo/android', resolver 'react-native-worklets/jest/resolver',
// React Compiler turned on through resolveBabelOptions (jest-expo leaves it off by default)
// jest.setup.ts
import { setUpTests } from 'react-native-reanimated';
setUpTests();
jest.mock('react-native-svg', () => {
  const svg = jest.requireActual('react-native-reanimated/src/mock-svg');
  return { ...svg, default: svg.Svg };          // Reanimated's documented SVG mock, plus a default export
});
```

- **Resolver.** Reanimated 4.5.1 doesn't ship the `jest/resolver` its current docs name. That file arrives in 4.7, which belongs to SDK 58.
- **Timers.** Use `jest.useFakeTimers()` with `jest.advanceTimersByTime` or `jest.runAllTimers()`. The older timer helpers are deprecated.
- **Async APIs.** RNTL 14's `render` and `act` are async.
- **Unistyles.** `jest.setup.ts` imports `react-native-unistyles/mocks` and then `src/theme/unistyles.ts`.
- **Types.** TypeScript 6 defaults `types` to none, so `tsconfig.json` lists `jest` and `node`.
- **Renderer.** `test-renderer` 1.3.1 asks for `react-reconciler` 0.34, which needs React 19.3. An npm `overrides` entry pins it to 0.33.0 to match React 19.2.3.

| Layer | What it proves | How |
| --- | --- | --- |
| Pure functions | Poses are valid (one mouth, one eye state). Wobble amplitudes, countdown and reveal maths, `digitStyle`, `ringOffset`, Calm and Off forms, the director's priority table | Plain Jest with literal expected numbers. This is the pattern Reanimated Carousel uses |
| Component, values at time t | For each interaction, the animated style or SVG prop at the start, one midpoint and the end. Examples: Unlock's face slide at 0, 160 and 1350 ms; digit column 0 at 100 ms; a key at `translateY: 4` on press | `toHaveAnimatedStyle` and `toHaveAnimatedProps` with literal values, written once from DESIGN.md's tables. This is the pattern in Reanimated's docs, Mattermost and Paper |
| Component, behaviour | Only one Sen animates. Calm leaves the body still. Rows don't re-render during a reveal. The list's data survives reveal | Jest render counters and `toHaveAnimatedStyle` |
| Device, flows | Unlock, reveal, add, delete and settings work end to end on the emulator | Maestro flows in `.maestro/`, with `waitForAnimationToEnd` before each assertion. Fingerprint through `adb -e emu finger touch 1` |
| Device, settled screenshots | Every pose and screen state matches its owner-approved baseline | Maestro `takeScreenshot` and `assertScreenshot`, over the dev states route (`sen://dev/states`) and the pose gallery (`sen://dev/states?screen=sen&pose=worried&size=200`). Baselines are approved by the owner, one set per emulator |
| Device, motion feel | Each moment looks right in motion | Maestro `startRecording` and `stopRecording` produce an MP4 for the owner to watch. It is evidence, not an assertion |
| Smoothness | No visible jank on a release build | The Perf Monitor on the owner's phone, release build. Optionally Flashlight running a Maestro flow, as Bluesky and Rainbow do |

**Emulator animation scales.** Leave the emulator's animation scales on. Android's usual advice is to turn them off for test stability. But Reanimated 4.5.1 reads a transition scale of 0 as reduced motion, which would make every moment jump to its end (V, source).

**Approval.** Agents never approve their own screenshot baselines. A new screen or pose with no baseline gets its screenshot posted for the owner, and the agent stops.

**Open risks, each with a 20-minute spike in PLAN.md.**
- The Android pull gesture over FlashList.
- Inserting a row with FlashList's keep-scroll-position on.
- The reveal commit cost on a slow phone. The fallback is one animated view per amount instead of per digit.

## Threat model

Sen has no server. Everything it protects is on the phone.

| # | Threat | Controls | Where | How a reviewer sees it |
| --- | --- | --- | --- | --- |
| T1 | Someone holding the unlocked phone | Lock on launch, protected routes, step-up for every write, idle lock, re-lock after background | `app/_layout.tsx`, `features/auth/` | Kill and reopen: Lock. Delete: Face ID every time |
| T2 | Shoulder surfing | Masked by default, reveal times out (30 s to 2 min) | `features/transactions/` | The ring counts down, then coins |
| T3 | App switcher snapshot | Privacy cover on `inactive` plus `enableAppSwitcherProtectionAsync` (iOS). FLAG_SECURE app-wide in release builds (Android) | `features/security/` | Open recents |
| T4 | Screenshots and recording | FLAG_SECURE in release (Android). `usePreventScreenCapture` on sensitive screens (iOS 13+). Off in dev builds so agents can screenshot, with a test that release always guards | `features/security/screen-guard.ts` | Screenshot in the release APK: blocked |
| T5 | Malicious or malformed input | Custom keypad, integer sen, zod limits, sanitiser | `features/add/`, `models/draft.ts`, `services/sanitize.ts` | Paste RTL marks: stripped |
| T6 | Tampered or corrupt data | zod on every read, drop and count, reset on an unreadable database | `services/tx-repo.ts` | Reviewer control "Bad data" |
| T7 | Leaks via logs, crash reports, clipboard, accessibility, devtools | No amount in JS while masked. Logger takes event codes only, `console` banned by lint. Clipboard gets the reference only. Cache cleared on lock. Error UI never shows messages | `features/transactions/`, `services/logger.ts` | Screen reader says "Amount hidden" |
| T8 | Deep links that skip the lock | Protected routes are not mounted while locked | `app/_layout.tsx` | `adb shell am start -d sen://transaction/x`: Lock |
| T9 | Double submit | Idempotency key, disabled key | `features/add/`, `services/tx-repo.ts` | Tap Save twice fast: one row |
| T10 | Backup extraction | `allowBackup: false`, `THIS_DEVICE_ONLY` key | `app.config.ts`, `services/db-key.ts` | Inspect `AndroidManifest.xml` |
| T11 | Bad data from the "API" | `TransactionSchema` parse at sync | `services/sync.ts` | Reviewer control "Bad data" |

**What this does not protect against.** The README says this in plain words.

| Item | Why |
| --- | --- |
| A rooted or instrumented device | The step-up result is a JS boolean. A hooked runtime can skip it. A production app would bind the key to biometrics or verify a signed challenge on a server |
| Amounts while revealed | They sit in JS memory, the share sheet and the screen reader tree. Masking protects the masked state |
| Winding the device clock back | It extends a reveal. Background re-masks at once anyway |
| Root or jailbreak detection, certificate pinning | Easily patched. No real server to pin |

## Tests (D16)

Unit and component tests with `jest-expo` and RNTL v14.
- **Ports.** Native modules sit behind small ports, with in-memory fakes in tests.
- **Real SQL.** The database runs real SQL through the `node:sqlite` adapter.
- **Coverage.** Thresholds apply to pure modules only.

| Property | File |
| --- | --- |
| No amount in JS while masked, totals included. Rendered tree has no digits | `features/transactions/masking.test.tsx` |
| List `data` reference unchanged across reveal and hide | same |
| 10k rows mount fewer than 60 row components | `features/transactions/history-list.test.tsx` |
| Every state and event pair. `BACKGROUND` during `authenticating` is ignored | `features/auth/machine.test.ts` |
| Re-lock window (59 s stays, 61 s locks), idle lock, reveal expiry | `features/auth/locks.test.ts` |
| Lock clears the cache, closes the database, drops the draft | `features/auth/session.test.ts` |
| Step-up prompts every time with `'strong'`. Cancel writes nothing | `features/auth/use-step-up.test.ts` |
| Locked deep link renders Lock | `__tests__/guard.test.tsx` |
| Sync twice and interrupted give the same table hash | `services/sync.test.ts` |
| Search "entral" matches a JS filter on 10k rows | `services/tx-repo.test.ts` |
| Seed is deterministic, valid, never in the future | `services/bank-api.test.ts` |
| Missing key resets the database. Key shape and storage options | `services/db-key.test.ts` |
| Log schema rejects amounts | `features/security/activity-log.test.ts` |
| Input limits, keypad cap, sanitiser | `models/draft.test.ts`, `features/add/keypad-reducer.test.ts`, `services/sanitize.test.ts` |
| Money: sign, split numerals, spoken amounts | `models/money.test.ts` |
| Release config always guards screens | `features/security/screen-guard.test.ts` |
| Selector and query benches on 10k rows within budget | `*.bench.test.ts` |

## Builds and delivery

**Development (D17).**
- **Platform.** WSL2 with no Mac.
- **Build.** Android dev builds with `npx expo run:android`, using the SDK at `~/Android/Sdk` and JDK 17.
- **Device.** The Windows emulator (`Sen_API36`), reached from WSL through one shared adb server.
- **Driver (D18).** Maestro, plus raw adb for fingerprint taps, deep links and logs.
- **Real phone.** For final performance numbers and the demo.

**Reviewers.**

| Route | Status |
| --- | --- |
| Android APK from EAS Build (`preview` profile), linked from the README and a GitHub release | Primary |
| Run from source on an Android emulator | Secondary |
| iOS simulator build from EAS | Bonus for reviewers with a Mac. Untested by the author |
| Expo Go | Not supported |

**EAS.**
- The free plan gives 15 Android builds a month.
- Build on tags only.

**Biometrics on emulators.**
- **Android.** Set a PIN, enrol a fingerprint, then `adb -e emu finger touch 1`. The API 36 emulator's fingerprint is Class 3 (`dumpsys fingerprint` shows strength 15), so `'strong'` passes, and the prompt still offers "Use PIN" (V, 2026-10-16).
- **iOS Simulator.** Features › Face ID › Enrolled.

**CI (D21).**
- **Every push.** GitHub Actions runs `tsc --noEmit`, `expo lint` and `jest --ci` on Node 22.13 or later.
- **Pre-commit.** A hook in `.githooks/` runs typecheck and related tests.
- **Tags.** An EAS Android build.
