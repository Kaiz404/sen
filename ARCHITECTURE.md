# Sen architecture

How Sen is built. It follows the decisions in [DECISIONS.md](DECISIONS.md), made on 2026-10-15. Phases 0 and 1 are built. Paths for later phases are the plan. Claims marked **V** were verified against a primary source on 2026-10-14 or 2026-10-15. Claims marked **I** are inferred.

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
| Lint | ESLint 9 flat + `eslint-config-expo` + Prettier 3 | | Layer zones, no-cycle, no-console, raw-hex ban, `.value` ban, `useReducedMotion` ban, `runOnJS` ban, `'cubic-bezier('` string ban, `withExclusiveTransactionAsync` ban, and `node:sqlite` or `db/testing` imports outside test files |
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
 │ dev/states     (guard={__DEV__})                              │
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
 │ vault  prefs  clock  crypto  sanitize  logger  haptics        │
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
| `src/components/` | Design-system primitives: `Amount`, `Key`, `Segmented`, `ReceiptSlip` (with `SlipRule` and `Leader`), `Stamp`, `Tag`, `ToastHost` and `toast`, `EnterOnce`, `Bone`. They take callbacks and never call services, so a feature fires the haptic. `stand-in.ts` maps board colours that have no theme token to the nearest token | `models/`, `theme/`, `motion/` |
| `src/app/` | expo-router routes only. Each renders a feature screen | `features/`, `components/`, `theme/`, `motion/` |

**Enforcement.** ESLint zones enforce this table, plus `import/no-cycle`. Deep imports across features are banned, and so is `console` outside `services/logger.ts`. File names are kebab-case and tests sit next to their files. Route tests are the exception. Expo Router bundles every file in `src/app/` as a route, so they live in `src/__tests__/`, and lint fails on a test file inside `src/app/`. The alias is `@/*` for `src/*`.

## Routes

Every route file is one line that re-exports a screen from a feature index, such as `export { DetailScreen as default } from '@/features/detail'`. Route files and `_layout.tsx` are final. No lane edits `src/app/`. A lane that needs a new route asks the coordinator.

| File | Screen | Guard |
| --- | --- | --- |
| `index.tsx` | `HistoryScreen` (transactions) | `unlocked` |
| `transaction/[id]/index.tsx` | `DetailScreen` (detail) | `unlocked` |
| `transaction/[id]/delete.tsx` | `DeleteSheet` (add), form sheet | `unlocked` |
| `add/_layout.tsx` | `AddLayout` (add), full-screen modal | `unlocked` |
| `add/index.tsx`, `add/details.tsx`, `add/review.tsx` | `AmountStep`, `DetailsStep`, `ReviewStep` (add) | `unlocked` |
| `settings/index.tsx`, `settings/activity.tsx` | `SettingsScreen` (settings), `ActivityScreen` (activity) | `unlocked` |
| `settings/privacy.tsx`, `sign-out.tsx`, `reset-demo.tsx` | `PrivacySheet`, `SignOutSheet`, `ResetDemoSheet` (settings), form sheets | `unlocked` |
| `settings/erase.tsx` | `EraseSheet` (security), form sheet | `unlocked` |
| `+not-found.tsx` | Redirects home | `unlocked` |
| `welcome.tsx`, `primer.tsx` | `WelcomeScreen`, `PrimerScreen` (auth) | `welcome` |
| `lock.tsx` | `LockScreen` (auth) | `locked` |
| `dev/states.tsx` | `StatesScreen` (gallery) | `__DEV__` |

**Guard contract.**
- `useRouteGate()` from `@/features/auth` returns one of three values: `'welcome'`, `'locked'` or `'unlocked'`. One value can't express "unlocked but never onboarded". The auth lane maps its reducer onto it: `authenticating` from locked stays `'locked'`, and `revealed` and `stepUp` are `'unlocked'`.
- `_layout.tsx` declares every route inside exactly one `Stack.Protected`, with all presentation options. A deep link whose guard is false lands on the first available screen and is not replayed after unlock.
- `+not-found` sits in the unlocked guard. Its redirect home does nothing while home is guarded, so a locked unknown link falls through to Lock instead.
- The dev route is `dev/states`, not `(dev)/states`, because a group name never appears in the URL. In release `__DEV__` is false, so `sen://dev/states` lands on Lock.
- `src/__tests__/guard.test.tsx` renders the real layout over every route file on disk. A new route file is tested the moment it exists, because expo-router mounts an undeclared route outside every guard.

**Seams.** The root layout reads only seams, and their names are frozen. The bodies belong to the owning lane.

| Seam | From | Phase 1 body |
| --- | --- | --- |
| `RouteGate`, `useRouteGate`, `SessionRoot`, `LockScreen`, `WelcomeScreen`, `PrimerScreen` | `@/features/auth` | A module store that starts `'locked'`. The stub Lock calls `authenticateAsync` and unlocks. `SessionRoot` mounts the `QueryClientProvider` |
| `useSenMotionPreference` and the settings screens | `@/features/settings` | Returns `'full'` |
| `useScreenGuard`, `EraseSheet` | `@/features/security` | Does nothing |
| `ToastHost` | `@/components/toast` | Renders nothing |
| `StatesScreen` | `@/features/gallery` | `screen=db` runs the database smoke. Any other query is echoed |
| `hasVault`, `openVault`, `destroyVault`, `VaultOpened` | `@/services/vault` | Rejects. Lane 2b owns the body |
| `readPref`, `writePref`, `subscribePrefs`, `clearPrefs` | `@/services/prefs` | Reads return the default. Writes do nothing |

Placeholder screens render `StubScreen` from `src/features/stub/`, so no lane's folder hosts another lane's placeholder. Phase 6 deletes that folder.

**Query client.** `services/query-client.ts` holds the one `QueryClient`, the `Register.defaultError = AppError` augmentation and the key roots `QK.tx` and `QK.revealed`.

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

type MaskedRow = Omit<Transaction, 'amountMinor'> & { day: DayKey }   // what masked queries return
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
| `transaction.ts` | `TransactionSchema`, the strict `MaskedRowSchema` (a selected amount fails the parse, and `day` is required for the day headers), and `TransactionPageSchema` for the mock bank's `{ items, nextSeq }` envelope |
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
- **Columns.** `tx` stores `posted_at` in UTC and a `day` column in Malaysia time (UTC+8). Its page index is `(posted_at desc, id desc)`. `search_text` is lowercased and stripped of accents at write time.
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

Indexes: `tx_by_time (posted_at DESC, id DESC)`, which the keyset page query searches with no sort step, and `activity_log_by_time (at DESC, id DESC)`.

**Sync (D2).**
- **The bank.** `services/bank-api.ts` is an in-app mock with one endpoint, `fetchPage({ since, limit })`. It returns a `TransactionPageSchema` envelope whose items carry their feed `seq`, or a `Result` error of kind `offline`, `timeout` or `server`. `nextSeq` is null once a page reaches the end of the feed.
- **Seed (D5).** `services/seed.ts` builds the feed with mulberry32 (seed 57), oldest first, so `seq` grows with time. Sizes are 20, 1k (the default) and 10k. The bank builds a size's feed at its first request and keeps it, so the pages of one sync agree.
- **The boards' rows.** The newest 20 rows of every size are the boards' sample data: Tealive, the DuitNow from Aisyah Rahman, the Grab ride to KL Sentral, TNB electricity (RM 142.60, `FT26101400478213`), Shopee, the Touch 'n Go reload, GrabFood and the salary, then twelve rows for 1 to 12 Oct. With the boards' added row (Lunch with Hafiz, RM 42.50), 1 to 15 Oct sums to Money out RM 2,317.40 and Money in RM 6,850.00, as on SF-Reveal.
- **Dates.** The boards' "today" is today in Malaysia once 1:15 pm (the latest board row) has passed, and yesterday before that, so no row is ever in the future. The tail walks back about three rows a day for 1k (to Nov 2025 from 15 Oct 2026) and fourteen a day for 10k (to Sep 2024), with the salary on the boards' payday each month.
- **Reviewer faults.** The bank reads a `BankScenario` (`next`, `size`, `slow`, `newOnRefresh`) before every request. The settings lane feeds it from the `demo.*` prefs. `offline`, `timeout` and `server` fail the request. `bad_data` adds two broken rows with no `seq` to every page, so the real rows still arrive. `slow` waits 3 s before each request. `next` stays as set until something changes it.
- **New row on refresh.** With `newOnRefresh` on, a request past the end of the feed mints one pending row at now. So each refresh after a full sync brings exactly one row.
- **Upsert.** `sync(db, bank)` asks for pages of 500 after the saved cursor and parses each item on its own as a bank row (`source` must be `bank`). Each page upserts in chunks of 50 rows (`INSERT … ON CONFLICT(id) DO UPDATE … WHERE tx.source = 'bank'`) and saves the cursor (the highest item `seq`) and `synced_at`, all in one transaction. A sync that stops anywhere resumes from the last commit, and a second run converges on the same table. A bank row never overwrites a row added on the phone.
- **Results.** `sync` returns a `Result`. Transport errors pass through. A body that is not a page, or a page that asks for more without moving the cursor, is `server`. Bad rows are dropped and the good ones kept, and the result is `invalid_data` with the count.
- **Dataset switch.** `resetBankRows(db)` deletes bank rows and rewinds the cursor in one transaction. Added rows stay. The next sync loads the new size and reports `onProgress(received)` after each page.
- **Pull-to-refresh.** Runs `sync()` through a TanStack mutation. Retries cover `offline`, `timeout` and `server` once, never `invalid_data`.

**Reads (D3, D4).**
- **Module.** `services/tx-repo.ts`. Every function takes `db` first. A filter is `{ flow: 'all' | 'in' | 'out', search }`.
- **Pages.** `readPage` returns keyset pages of 100, newest first, on `(posted_at, id) < cursor`. It reads one extra row, so `next` is null on the last page. `useInfiniteQuery` loads the pages into FlashList.
- **Totals.** `readTotals` groups by `type` and `readDayNets` by `day`, newest day first, over a range of Malaysia days. The range becomes bounds on `posted_at`, so the page index serves it.
- **Search.** `LIKE` on `search_text`, with `\`, `%` and `_` escaped. `search_text` and the query both go through `searchKey` (cleaned, accents stripped, lower case). Search matches the description only. The input is debounced with `useDeferredValue`.
- **Detail.** `getTransaction(db, id)` is masked and `getRevealedTransaction` adds the amount. Both return null for a missing or unreadable row.
- **Writes.** `insertManual(db, draft, now)` stores a draft as `m-<idemKey>` with a `SEN-M-` reference made from the key, at the current Malaysia time of day on the chosen day. A repeated `idemKey` writes nothing and returns the stored row with `created: false`. `deleteManual` returns `deleted`, `missing` or `read_only` (bank rows).
- **Undo.** `deleteManual` keeps the deleted row as JSON in `meta` (`undo.deleted`), and `restoreDeleted` moves it back. Both run in SQL, so undo never brings the amount into JS. `eraseManual` deletes every added row and the undo copy.
- **Freshness.** The one write module calls `invalidateQueries(['tx'])` after every commit.
- **Measured.** A Jest bench on 10k rows (seed 57), `node:sqlite` on WSL, 50 runs after 5 warm-up, p95: first page 2.9 to 5.0 ms, a page after row 5,000 3.5 to 4.9 ms, month counts or sums 0.1 ms, 7-day nets 0.1 to 0.6 ms, 300 revealed amounts 1.0 to 2.2 ms, search "entral" page and count 5.7 to 6.4 ms. A full sync of 10k rows took 325 to 386 ms. These are desktop numbers, not phone numbers. On a page, the SQL alone is 0.7 to 1.2 ms at p50, so parsing 100 rows with zod is about two thirds of the time.

**Masking (D6).**
- **Masked queries.** `readPage`, `readTotals`, `readDayNets` and `getTransaction` never select `amount_minor`. Masked totals and day nets return counts only. Every function that returns an amount has `Revealed` in its name.
- **Shown or hidden.** The `hideAmounts` pref decides, not the session. It survives lock and restart. Showing goes through `useStepUp('reveal')`. Hiding never prompts.
- **On show.** `readRevealedAmounts(db, { filter, through })` loads `id → amountMinor` for the loaded rows, from the newest down to the last loaded row, keyed `['tx','revealed',…]`. `readRevealedTotals` and `readRevealedDayNets` add sums and nets. Rows read the map through `useAmountView(id)`, which returns `null` while masked. The list's `data` never changes on reveal.
- **On hide.** `removeQueries(['tx','revealed'])`. Lock also clears it with the whole cache.
- **Honest limit.** While revealed, amounts sit in JS memory. While masked, no amount exists in JS.

## State

**Session.**
- **Reducer.** A pure reducer in `features/auth/machine.ts`, a discriminated union with an exhaustive `switch`, no timers and no I/O. An event that does not apply returns the same object, so the store skips the notify.
- **Store.** A Zustand store in `features/auth/session.ts` wraps it. `dispatch` runs the reducer, then the effects of the transition (On `LOCK`).
- **React.** Components select narrow slices. Rows never subscribe to the session.
- **Outside React.** AppState, the tick and the actions read `sessionStore.getState()`.
- **Not in the session.** Whether amounts show is the `hideAmounts` pref (D27), so it survives lock and restart. See Showing and hiding amounts below.

**The open database.** The unlocked states carry the one `OpenDb`, so "unlocked with no database" can't be written down. `openVault()` gives it on unlock and the store closes it when the session leaves the unlocked states. Screens read it with `useDb()` from `@/features/auth` and pass it to service functions, which never hold one. A screen still animating out after a lock keeps the closed handle, so a late query rejects with "The database is closed." instead of the screen throwing (inferred: react-native-screens keeps a closing screen mounted for its exit animation).

**Screen-local state.** Search text, filter and the add draft stay in `useState` or `useReducer` in their screen. The draft lives in memory only.

```
 launching ──LAUNCHED, no vault──► welcome ◄─────────────────── RESET ────────────────────┐
     │                              │   ▲                                                 │
     │                   AUTH_START ▼   │ AUTH_FAIL                                       │
     │                     authenticating{setup}                                          │
     │                              │ UNLOCK_OK                                           │
     │                              ▼                                                     │
     │                      unlocked{since, db} ◄── STEP_UP_DONE ──┐                      │
     │                         │        │                          │                      │
     │                    LOCK │        └── STEP_UP_START ──► stepUp{action, returnTo}    │
     │                         ▼                                                          │
     └──LAUNCHED, vault──► locked{reason} ────────────────────────────────────────────────┘
                              │   ▲
                   AUTH_START ▼   │ AUTH_FAIL
                    authenticating{unlock} ──UNLOCK_OK──► unlocked
```

| Event | From | To |
| --- | --- | --- |
| `LAUNCHED` | `launching` | `locked{launch}` with a vault, `welcome` without |
| `AUTH_START` | `welcome`, `locked` | `authenticating{setup}`, `authenticating{unlock}` |
| `UNLOCK_OK` | `authenticating` | `unlocked{since, db}` |
| `AUTH_FAIL` | `authenticating` | Back to `welcome` or `locked{reason}` |
| `STEP_UP_START` | `unlocked` | `stepUp{action, returnTo}` |
| `STEP_UP_DONE` | `stepUp` | `returnTo` |
| `LOCK` | `unlocked` | `locked{reason}` |
| `RESET` | `locked` | `welcome` |

Every other pair returns the state unchanged. `machine.test.ts` checks all 63 pairs.

| State | Holds | Gate | Routes allowed |
| --- | --- | --- | --- |
| `launching` | Nothing. The splash stays up | `locked` | `lock` |
| `welcome` | Nothing. No vault yet | `welcome` | `welcome`, `primer` |
| `locked` | `reason`: launch, idle, background, manual, signout | `locked` | `lock` |
| `authenticating` | `purpose`: `unlock` from Lock, or `setup` from the primer | `locked` or `welcome` | Current screen stays |
| `unlocked` | `since`, `db` | `unlocked` | All protected routes. Amounts follow `hideAmounts` |
| `stepUp` | `action`, `returnTo` (the unlocked state, `db` included) | `unlocked` | Current screen stays |

- **Launch.** `SessionRoot` runs `hasVault()` and `detectBiometric()` once. No vault goes to Welcome. A vault, or a failed check, goes to Lock, so Welcome never opens over existing data. The splash lifts after the gate is known.
- **Unlock.** `unlock()` prompts, then calls `openVault()`. A `reset` result leaves a `db_reset` notice that History reads with `useDbResetNotice()` and clears with `dismissDbResetNotice()`. A vault that fails to open returns to Lock with the generic error.
- **Sign out.** `signOut()` serves Settings and "Not you? Start again" on Lock. It locks, waits for the database to close, calls `destroyVault()` (which also clears prefs), then shows Welcome.
- **Biometric name.** Copy names the device's own biometric: Face ID or Touch ID on iOS, fingerprint or face unlock on Android, from `supportedAuthenticationTypesAsync()`. `ready` is a strong biometric enrolled (`getEnrolledLevelAsync()`). When it is false, Lock and the primer open on "is off".
- **Exports.** `useRouteGate`, `useDb`, `useStepUp`, `useAmountsHidden`, `showAmounts`, `hideAmounts`, `useDbResetNotice`, `useBiometric`, `lockNow`, `signOut`, `armLockout` (the reviewer lockout control) and `dismissDbResetNotice`. The screens export a prop-driven view next to each container (`LockView`, `PrimerView`, `WelcomeView`) for the gallery.

**Showing and hiding amounts (D27).** `features/auth/amounts.ts` owns the `hideAmounts` pref's behaviour.
- `useAmountsHidden()` reads the pref through `useSyncExternalStore` on `subscribePrefs`, so every writer re-renders it.
- `showAmounts()` runs step-up `reveal` and writes `hideAmounts: false` only when the check passes. A cancel writes nothing.
- `hideAmounts()` writes `true` and never prompts.
- `SessionRoot` runs `dropRevealedOnHide()`. Whenever the pref reads hidden after a change, from any writer including `clearPrefs`, it runs `removeQueries(['tx','revealed'])`. Masked pages stay cached.
- Lock and the primer say "Amounts stay hidden until you choose to show them." only while the pref hides them.

**Step-up.** `useStepUp(action)` returns a function. Each call prompts and resolves to `{ ok: true } | { ok: false; reason }`, with `reason` one of `cancelled`, `mismatch`, `lockout`, `not_set_up`, `unavailable` or `unknown`. Nothing is cached, so every write prompts. A call while another prompt is up resolves `cancelled` without a second prompt.

| Action | Prompt | On success | On cancel |
| --- | --- | --- | --- |
| `reveal` | "Show amounts" | `showAmounts()` writes `hideAmounts: false` | Stay hidden, silently |
| `add` | "Save this transaction" | DB write, log `tx.added` | "Not saved. Your draft is still here." |
| `delete` | "Delete this transaction" | DB delete, log `tx.deleted` | Sheet stays |
| `clearLog` | "Clear security activity" | Log cleared, one `log.cleared` entry left | Nothing |
| `erase` | "Erase transactions you added" | Manual rows deleted, log `data.erased` | Nothing |

The writes and logs belong to the callers. Undo inside the 6 s toast skips the prompt. It only reverts what the user just authorised, and it is logged.

**`authenticateAsync` options.** One path, `authenticate()` in `features/auth/prompt.ts`, serves unlock and step-up.
- `biometricsSecurityLevel: 'strong'`.
- `disableDeviceFallback: false`.
- `isAuthenticatingRef` is set before the prompt and cleared in `finally`. A prompt requested while it is set resolves `cancelled`.

How the first two combine on a phone with only weak biometrics isn't documented, so it gets tested on a device.

**Error codes.** The table `FAILURE` in `prompt.ts` types every `LocalAuthenticationError`, so a new code fails `tsc`.

| Codes | Reason | Lock and primer UI |
| --- | --- | --- |
| `user_cancel`, `system_cancel`, `app_cancel` | `cancelled` | Return silently. Not an error |
| `user_fallback` | `cancelled` | Sen always allows the passcode, so the OS handles it. Treated as a cancel |
| `authentication_failed` | `mismatch` | "Not quite." with "2 more tries before fingerprint locks". Three tries are shown (inferred). At zero it points to the passcode |
| `lockout` | `lockout` | "Too many tries." with a 30 s cool-down card (Android's lockout length, inferred), and the passcode |
| `not_enrolled`, `passcode_not_set` | `not_set_up` | "Fingerprint is off." Open device settings, or the passcode |
| `not_available` | `unavailable` | Explain, passcode |
| `no_space`, `timeout`, `unable_to_process`, `invalid_context`, `unknown` | `unknown` | "Something went wrong." Generic retry |

**Android and a wrong finger.** expo-local-authentication 57.0.3 on Android keeps BiometricPrompt open on a failed match and never resolves `authentication_failed` (V, `LocalAuthenticationModule.kt` maps only `onAuthenticationError`). The system sheet shows the miss itself. "Not quite." appears on iOS, where LocalAuthentication reports the failure.

**Lock triggers** (`features/auth/locks.ts`, wired by `SessionRoot`).

| Trigger | Mechanism |
| --- | --- |
| Background | AppState `background` stores `backgroundedAt`, unless a prompt is up. It does not hide amounts (D27) |
| Return | On `active`, lock if `now − backgroundedAt > relockAfter`. Never auto-prompt |
| Idle | `onTouchStart` on the `SessionRoot` view resets `lastTouch`, a plain module variable. A 15 s tick compares it with `idleLock`. The tick skips while backgrounded, and `active` restarts the count |
| Manual | "Lock now" calls `lockNow()` |

**The iOS inactive trap.** The Face ID sheet itself sends the app to `inactive` and back. So:
- `isAuthenticatingRef` is set before the prompt and cleared in `finally`.
- Only `background` starts the re-lock window. `inactive` only shows the privacy cover, which the security feature owns.
- A `background` while a prompt is up is ignored, so a passcode screen that leaves the app does not count as leaving.
- The reducer ignores `LOCK` while in `authenticating` or `stepUp`, so an idle tick never cuts a prompt short.

**On `LOCK`:**
- `queryClient.clear()`.
- Close the database.
- Drop the draft. Protected routes, which include every sheet and the add flow, unmount.
- Leave `hideAmounts` as it is. Amounts shown before the lock show again after the next unlock.

A deep link that arrives while locked lands on Lock and is not replayed after unlock.

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
| MMKV `prefs` | theme, `hideAmounts`, `idleLock`, `relockAfter`, `senMotion`, `haptics`, `demo.*` | None. Nothing sensitive |

**Key.** 32 bytes from `expo-crypto` `getRandomValues`, stored as 64 hex characters. Read, write and delete all pass `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so the key is readable only while the phone is unlocked and is never restored to another device (V). A new key is stored only after its database opened, so a failed first open leaves no orphan key.

**Vault.** `services/vault.ts` exposes `hasVault()` (a valid key is stored), `openVault()` and `destroyVault()`. `createVault(ports)` holds the logic. SecureStore, the database file, random bytes and prefs sit behind `VaultPorts`, so the tests run the rules on fakes.

**Reset rules.**

| Stored key | Opening the file | Result |
| --- | --- | --- |
| Valid | Opens | `opened` |
| Missing, or not 64 hex | Opens (no file yet) | `created`, and the new key is stored |
| Missing, or not 64 hex | `DbUnreadableError` or `SchemaTooNewError` | The file is deleted and a fresh one created with the new key. `reset`, `missing_key` |
| Valid | `DbUnreadableError` or `SchemaTooNewError` | The file is deleted and a fresh one created with the same key. `reset`, `corrupt` |
| Any | Any other error, such as a busy disk | Rethrown. Nothing is deleted |

**Prefs.** `services/prefs.ts` keeps values as JSON strings in the MMKV instance `prefs`. Every read goes through `parsePref`, so a missing or corrupt value reads as its default. `subscribePrefs` hears every `writePref`, and every key after `clearPrefs`.

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
| Sign out | The caller closes the database. `destroyVault()` deletes the key first, so the file is unreadable even if deleting it fails, then deletes the file (one already gone is fine) and clears prefs |
| Erase | Step-up, then delete manual rows and log it |
| Key missing, database present | Backup restore or reinstall. Unreadable by design. Delete it, start clean, show `db_reset` (`missing_key`) |
| Database unreadable or newer than the app | Same, as `corrupt` |
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

The rig copies the boards' structure (`design/MAX-Library.dc.html`, `design/MAX-Moments.dc.html`). Node names are the boards' selectors, so a keyframe on `.M-unlock .elb` lands on the `elb.*` channels.

**Channels.**
- Every value Sen can animate is a named numeric channel, `<node>.<property>`. There are 66, declared once in `RIG` in `channels.ts` with their rest values. `Channel`, `CHANNELS`, `REST` and `CHANNEL_KIND` derive from it.
- Properties: `x` and `y` translate, `r` rotate, `k` skewX, `s` uniform scale, `sx` and `sy` scale, `op` opacity, `th` the spin angle in radians. Mouth and held-prop channels are opacities named by the shape (`mo.grin`, `prop.plug`). Units are rig units (1 unit = size / 600) and degrees.
- Opacity channels fade. Every other channel springs.
- A `Frame` is a full record of channels.

| Node | Board | Channels | Rest | Pivot | Moves |
| --- | --- | --- | --- | --- | --- |
| `mv` | `.mv` | `x` `y` `op` | 0 0 1 | | Travel, hops, the roll-in and launch fade |
| `rl` | `.rl` | `r` | 0 | Coin centre (10, 16) | Roll, flip arc |
| `sq` | `.sq` | `r` `k` `sx` `sy` | 0 0 1 1 | Contact point (10, 278) | Lean, counter skew, squash and stretch |
| `sp` | `.sp` | `th` | 0 | Coin centre | Edge spin. `scaleX = cos θ`, kept at least 0.02 from zero |
| `ck` | `.ck` | `op` | 0 | | Cheeks |
| `lk` | `.lk` | `x` `y` | 0 0 | | The face group slides across the disc, inside the face clip |
| `el`, `er` | `.el`, `.er` | `x` `y` `sx` `sy` | 0 0 1 1 | Eye box (∓72, −38) | **Pose layer.** What a pose holds: worried's nudge and 0.85, squint, happy, the peek crack |
| `elb`, `erb` | `.elb`, `.erb` | `sx` `sy` `op` | 1 1 1 | Eye box | **Open layer.** The ellipse. Blinks, squints and cracks that run over the pose |
| `elc`, `erc` | `.elc`, `.erc` | `sx` `sy` `op` | 1 1 0 | Arc box (∓72, −34) | **Shut layer.** The closed arc. Eye-close springs it in |
| `mo` | `.mo` | `sx` `sy`, then `smile` `small` `grin` `frown` `flat` `o` | 1 1, smile 1 | MAL2's smile box (0, 23.5) | Mouth scale (MAL2's wink, 1.6 by 1.8) and the six crossfaded mouths |
| `shades` | `.shades` | `x` `y` `r` `op` | 0 0 0 0 | Its box (0, −41) | Rides `lk`, inside the clip. Drops in on the theme change |
| `cap` | `.cap` | `x` `y` `r` `op` | 0 0 0 0 | Its box (63, −172.3) | Above the clip, outside `lk` |
| `pl`, `pr` | `.pl`, `.pr` | `x` `y` `r` `s` | 0 0 0 1 | Paw centre (∓106, 152) | **Pose layer.** Wave, perch, celebrate, clutch |
| `plf`, `prf` | `.plf`, `.prf` | `x` `y` `r` `s` | 0 0 0 1 | Paw centre | **Secondary layer.** Trails a lean or a hop. Held props ride `prf`, behind the paw |
| `prop` | `.prop` | `magnifier` `plug` | 0 0 | | Which held prop shows |

- **Pivots.** The boards use `transform-box: fill-box`, so each pivot is the centre of that node's drawn box (`ORIGIN` in `art/geometry.ts`). A held prop would widen the board's `pr` box, so the rig keeps the paw centre as the paw pivot. This only matters when a paw holding a prop scales or turns (worried with the plug, at 0.9).
- **Layers compose.** A pose sets the pose layers (`el`, `er`, `pl`, `pr`) and which of each eye's open and shut layers shows. It leaves the open, shut and secondary layers at scale 1 and offset 0. A blink, eye-close, peek crack or squint runs on the open and shut layers, so it plays over any held pose. A test blinks over a held squint and checks the squint survives.
- **Hand-off (inferred, for lane 4d).** The boards animate the squint, the crack and the happy squint on `elb`. A moment that ends in a pose holding one of them hands the value to the pose layer on its last frame. The drawn eye is the product of the two layers, so nothing moves.

**Poses.**
- A pose is a `PoseSpec` in `poses.ts`: one eyes kind, one mouth, at most one prop, cheeks, the face slide, the body (`lift` for `mv.y`, `lean` and `skew` for `sq.r` and `sq.k`, `squash` for `sq.sx` and `sq.sy`) and each paw's pose layer (offset, rotation and uniform scale). `poseFrame(pose, prop?)` expands it into a full `Frame`. A spec can't name two mouths.
- The values come from kit.py, MAX-Moments' static tiles and the held frames of MAX-Library's primitives. DESIGN › Poses lists them. A test checks every pose against those numbers, literally.
- Discrete choices are opacity channels. Exactly one mouth is at 1, each eye shows exactly one of its open and shut layers, and a test checks every pose with every prop.

**Drawing.**

| Node | Kind | Notes |
| --- | --- | --- |
| `mv`, `rl`, `sq`, `sp` | Four nested `Animated.View`s | Static `transformOrigin` for the pivots (coin centre, contact point). These take Reanimated's fast native path on Android. `mv` also carries the rig's opacity |
| `hd`, `tl` | SVG groups inside `sp` | Heads while `cos θ ≥ 0`, tails otherwise |
| Edge pill | Its own SVG inside `sq`, after `sp` | Shows while `\|cos θ\| < 0.12` (MAX-Spec). It never takes the spin's scale |
| Rim, face disc | Static SVG | |
| Clip `G` | Static | Never animated, so the face can slide behind the rim while the clip stays put |
| `lk`, eye layers, `mo`, paw layers, `cap`, `shades` | `AnimatedG` with a `matrix` computed in a worklet (`mat(tx, ty, r, sx, sy, ox, oy)`) | RNSVG native accepts only `matrix`, not `translateX` or `originX` (V, source). This avoids the pivot bug |
| Mouths, cheeks, held props | `AnimatedG` opacity | One channel per node, so idle nodes do no work |
| Accents | Two SVG layers inside `mv` | The swoosh draws behind the coin, before `rl`. Stars and ticks draw after `rl`. Neither follows the spin. Mounted only while they play |

**Accents.**
- `accentShapes(tone)` in `art/geometry.ts` holds the board geometry. The swoosh is `M-330 60 Q-330 250 -140 300`, stroke 44 with round caps. Stars are filled and stroked 10 wide with round joins. Three ticks are stroked 18 wide.
- The boards draw the swoosh on with `pathLength="100"`. react-native-svg supports `pathLength` only on web (inferred from its source), so the swoosh dashes by its real length, `SWOOSH_LENGTH` (334.2 units). A board dash offset `d` becomes `d × 334.2 / 100`.
- Colours follow the surface Sen sits on: `SEN_ACCENT_TONES` in `src/theme/colors.ts`. On a pastel, ink marks and a paper swoosh at 75%. On the ink hero, lemon marks and a lemon swoosh at 22%. On the cream canvas, deep green marks and a green swoosh at 16%.

- **One public `<Sen>`.**
  - Without an `id` it renders `SenStatic` (`features/sen/components/sen-static.tsx`), a memoised pure render of a pose with no Reanimated hooks. That covers headers, toasts and the app-switcher cover. Under 48 pt it draws face and eyes only. It walks `treeFor(senTier(size))`, calls each node's `read(poseFrame(pose, prop), unit)` and skips nodes at opacity 0. Clip ids come from `useId()`. It never draws accents or the edge pill, because a pose never spins.
  - Until the rig exists, `<Sen id>` also renders `SenStatic`.
  - With an `id` it renders `SenRig`, which registers with the director.
- **Shared node code.** Both render from the same node functions (`art/nodes.ts`), so the static and animated drawings can't drift.
  - `NODES` gives each part its declared channels and a worklet `read(frame, unit)`. A test calls each `read` through a recording Proxy and checks it reads exactly its channels, because a mapper wakes for every shared value it captures.
  - `SVG_TREE` holds the coin's nesting and draw order as data, in the boards' order: rim and face, cheeks, the clipped `lk` (eyes, mouths, shades), the cap, then the paws. `treeFor(tier)` drops cheeks, mouths, paws and held props at the face tier.
  - Geometry in `art/geometry.ts` is copied from kit.py, and the tails face, edge pill and accents from MAX-Library and MAX-Moments.
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
- **Easing.** Every easing uses the canvas curves as `Easing.bezier`: out `.2,.8,.2,1`, sine `.37,0,.63,1`, inQ `.55,.085,.68,.53`, outQ `.25,.46,.45,.94`, inS `.12,0,.39,0` and outS `.61,1,.88,1`. The board and the app then draw the same curve.
- **Launch curves.** MAL-Timelines adds `malSpring` `.34,1.56,.64,1` (one overshoot, `SPRING.launch` damping 12 and stiffness 180 as a spring), `handoff` `.3,1.25,.5,1`, and the hop curves `hopOut` `.2,.7,.4,1` and `hopIn` `.6,0,.8,.3`. `src/motion/tokens.ts` holds each as `BEZIER`, `EASE` (for `withTiming`), `EASE_FN` (a plain worklet function, for `kf`) and `EASE_CSS`.
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
- **Informational timers.** The lockout cool-down keeps counting in every mode, using `ReduceMotion.Never`.

### Animated components

Shared primitives are built once, so no agent re-implements a pattern.

| Component | How it moves | Thread and renders | Test |
| --- | --- | --- | --- |
| Amount reveal | `<RevealProgressProvider>` holds one shared value. Each digit column has a `useAnimatedStyle` (`digitStyle(p, col)`) | UI. About 20 mounted rows render once when the amounts map arrives, then zero during the roll. The spike measured zero parent re-renders | `toHaveAnimatedStyle` at 100 ms. Commit counter |
| Press keys | `<Key>`: Gesture Handler `Pressable` (immune to the Android fast-path press bug, V). The face slides 4 px onto a static shadow plate with a 90 ms CSS transition, 0 ms outside Full. No shadow animates. Tones `lemon`, `loud`, `paper` and `outline` (no fill, no plate). Sizes `regular` (46), `medium` (52), `large` (56) and `xlarge` (60) come from the boards. `surface="hero"` draws a key on the ink hero with the dark palette in both themes. A disabled key washes its face out, or dashes an outline key. An icon-only key must carry a label | UI after one render | `pressIn` gives `translateY: 4`. A disabled key reads as disabled (`key.test.tsx`) |
| Segmented control | `<Segmented options value onChange>`. Equal segments in one lane, so the pill is `100/n %` wide and slides by percent `translateX` with a 200 ms CSS transition, 0 ms outside Full. Nothing to measure. Segments are radios. The caller fires the haptic | UI | Press "In" gives `translateX: '100%'` (`segmented.test.tsx`) |
| New row slide-in | `<EnterOnce>` runs the board's `slidein` keyframe once on mount, 900 ms, in Full only (`enterStyle(level)`). The list mounts it only for the just-added id, set by a store flag cleared at 900 ms, so recycled cells never replay it | UI | Pure `enterStyle` test. The list lane tests that the wrapper exists for that id only |
| Toasts, offline banner | One `<ToastHost>` at the root with module-level `FadeInDown` and `FadeOutDown`, keyed by id. Features call `toast.show({ title, detail?, action?, ttl?, mark? })`, which returns an id, and `toast.hide(id?)`. One toast at a time: a new one replaces the current one and its timer. The default is 6000 ms. A bar drains over the toast's life at every motion level, because it shows time left rather than decorating. `mark` takes a face-only `<Sen>` | UI | Undo runs once and dismisses. Gone at 6000 ms, not 5999. A replaced toast's timer can't hide the new one (`toast.test.tsx`) |
| Pull-to-refresh | Phase 1 is FlashList `refreshing` with Sen in an overlay slot. Phase 2, optional on Android, is a `Gesture.Pan` plus `Gesture.Native` with a `pull` shared value and `useThreshold` for the haptic | UI | `fireEvent(list, 'refresh')` calls the sync |
| Skeleton | `<Bone width height radius?>` with one CSS keyframe band, 1.4 s linear, in Full only. Calm and Off draw still bones | UI, no renders | Pure `bandStyle(level)` test (`bone.test.tsx`) |
| Launch | MAL2 (`design/MAL2-Loading.dc.html`, `design/MAL-Timelines.dc.html`). One loop clock, `useLoopClock(4200)`. Letters, drop and fade all derive from it through `kf(t, stops, values, eases)`, with MAL2's per-segment curves. The native splash equals frame 0: "Sen" on ink at the same scale and position, hidden in the loader's first `onLayout`. On Android 12 and later the system splash shows only a centred icon, so it is a lemon coin that crossfades into frame 0. Lock renders under the loader from frame 0. The handoff (2400 to 3110 ms) grows Sen into Lock's Sen at the same box while the ink panel shrinks into Lock's hero, and the loader unmounts at 3110 | UI, zero renders | Fake timers at key times |
| Theme switch | Unistyles, instant, no re-render | Native | Device render counter |
| Privacy cover | iOS: a plain conditional cover on `inactive`, no enter animation. Android: FLAG_SECURE, because Android never emits `inactive` (V) | | iOS: RNTL. Android: recents screenshot |
| Sheets, modal, pushes | Native stack. Fade in Calm and Off | Native | Device only |

Files: `src/motion/` holds `tokens.ts` (easing, springs, durations, `cubicBezier` CSS ports), `policy.tsx`, `countdown.ts` (`useSecondsLeft`, for the lockout cool-down), `threshold.ts` (`useThreshold`) and `timeline.ts` (`kf(t, stops, values, eases?)`, where `eases[i]` shapes the segment from `stops[i]` the way a CSS keyframe's timing function does, so hop arcs have no corners; and `useLoopClock`, a read-only clock derived from one linear run so laps never lose a frame). The components (`key`, `segmented`, `enter-once`, `skeleton`, `toast`, `countdown`) live in `src/components/`. Sen lives in `src/features/sen/` (`art/`, `channels.ts`, `poses.ts`, `timeline/`, `moments/`, `director/`, `components/`).

**Reading the level.** Components read the level only through `useMotionPolicy()`. `cssMs(level, ms)` in `src/components/motion-level.ts` zeroes every CSS transition outside Full, because CSS ignores reduced motion (V). Looping and decorative keyframes (`Bone`, `EnterOnce`) run in Full only.

**Colours.** Components read only theme tokens. Keys use `keyPlate` for the shadow plate, `keyEdge` for the paper key border, and `loud` with `onLoud` for the screen's one loud fill. `Bone` draws its band in `shimmer`, and the slip's dotted `Leader` uses `leader`. Key colours and every `MaterialCommunityIcons` `color` come from `useUnistyles()` in render, because on the device a live theme switch left text inside an animated view and icon colours on the old theme.

**States gallery.** `sen://dev/states` (dev builds only) draws any screen state from fixtures, with no services and no database.
- `?screen=<screen>&state=<state>` draws one state. `?screen=sen&pose=<pose>&size=<pt>` draws one Sen, and `?screen=sen` alone shows every pose at 32, 72 and 200 pt. No `screen` lists every link. `screen=db` runs the database smoke.
- `&theme=dark` or `&theme=light` forces a theme with `UnistylesRuntime.setAdaptiveThemes(false)` and `setTheme`, Unistyles' documented runtime switch, while the screen has focus. Leaving restores adaptive themes. `ScopedTheme` was not used, because its Jest mock renders nothing.
- Each drawn state mounts fresh, keyed by its query, and carries a test id `shot-<name>` so a flow can wait for the right screen.
- Component states draw in a captioned frame. Every other screen draws edge to edge, as it does in the app (`isComponent` in `registry.ts`).
- `auth` draws Welcome, the primer (`primer-ready`, `primer-off`) and every Lock state (`lock-idle`, `lock-checking`, `lock-mismatch`, `lock-lockout`, `lock-off`, `lock-unavailable`, `lock-error`) from `AUTH_STATES` in `src/features/auth/fixtures.tsx`, with Face ID as the boards draw it.
- **Registering a screen.** Export the screen's states from its own feature index as a plain object of render functions, such as `export const HISTORY_STATES = { masked: () => <HistoryView rows={FIXTURE_ROWS} /> }`, with the fixtures in that feature folder. Then add one entry to `SCREENS` in `src/features/gallery/registry.ts`, such as `history: HISTORY_STATES`. Type the object with `satisfies Record<string, () => ReactNode>` rather than importing the gallery's type, so the import runs one way.
- `.maestro/screenshots.yaml` is generated from the registry: every state in light and dark, then every pose at every tier. `src/features/gallery/flow.test.ts` fails when the file and the registry disagree. `UPDATE_FLOW=1 npx jest src/features/gallery/flow` rewrites it. Its shots are candidates in `shots/2a/`. The owner promotes approved ones to `assertScreenshot` baselines.

### Proving motion works

This follows what Reanimated's docs and large open-source apps actually do. A survey covered 15 projects, among them Expensify, Bluesky, Rainbow, Mattermost, React Navigation, FlashList and Reanimated itself.
- **Jest.** It checks values at chosen times.
- **Pure functions.** Motion maths lives in plain functions tested with literal numbers.
- **Maestro.** Flows and screenshots cover settled screens.
- **By eye.** Motion quality and smoothness are judged on a release build on a real phone.

No surveyed app pixel-tests frames mid-animation or gates animation FPS in CI, so Sen doesn't either.

**Board to milliseconds.** `python3 -I scripts/board-keyframes.py design/MAX-Moments.dc.html` prints every CSS animation on a board as a timeline: the selector, the keyframes' duration and delay, then each stop in ms with the easing that runs from it and its values. Easings with a token print by the token's name (`out`, `hopIn`). Moments are transcribed from this output, and their tests' literal values come from it.

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
- **Route tests.** `expo-router/testing-library` swaps Reanimated for its old mock. `jest.config.js` maps that mock to the real module (`jest/reanimated-for-router.js`), so route tests render the same Reanimated as every other test.
- **Renderer.** `test-renderer` 1.3.1 asks for `react-reconciler` 0.34, which needs React 19.3. An npm `overrides` entry pins it to 0.33.0 to match React 19.2.3.

| Layer | What it proves | How |
| --- | --- | --- |
| Pure functions | Poses are valid (one mouth, one eye state). Wobble amplitudes, countdown and reveal maths, `digitStyle`, Calm and Off forms, the director's priority table | Plain Jest with literal expected numbers. This is the pattern Reanimated Carousel uses |
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
| T2 | Shoulder surfing | Masked by default. Showing needs biometrics. Idle and re-lock windows still lock the app | `features/transactions/` | Coins until a biometric check |
| T3 | App switcher snapshot | Privacy cover on `inactive` plus `enableAppSwitcherProtectionAsync` (iOS). FLAG_SECURE app-wide in release builds (Android) | `features/security/` | Open recents |
| T4 | Screenshots and recording | FLAG_SECURE in release (Android). `usePreventScreenCapture` on sensitive screens (iOS 13+). Off in dev builds so agents can screenshot, with a test that release always guards | `features/security/screen-guard.ts` | Screenshot in the release APK: blocked |
| T5 | Malicious or malformed input | Custom keypad, integer sen, zod limits, sanitiser | `features/add/`, `models/draft.ts`, `services/sanitize.ts` | Paste RTL marks: stripped |
| T6 | Tampered or corrupt data | zod on every read, drop and count, reset on an unreadable database | `services/tx-repo.ts` | Reviewer control "Bad data" |
| T7 | Leaks via logs, crash reports, clipboard, accessibility, devtools | No amount in JS while masked. Logger takes event codes only, `console` banned by lint. Clipboard gets the reference only. Cache cleared on lock. Error UI never shows messages | `features/transactions/`, `services/logger.ts` | Screen reader says "Amount hidden" |
| T8 | Deep links that skip the lock | Protected routes are not mounted while locked | `app/_layout.tsx` | `adb shell am start -d sen://transaction/x`: Lock |
| T9 | Double submit | Idempotency key, disabled key | `features/add/`, `services/tx-repo.ts` | Tap Save twice fast: one row |
| T10 | Backup extraction | `allowBackup: false`, `THIS_DEVICE_ONLY` key | `app.config.ts`, `services/vault.ts` | Inspect `AndroidManifest.xml` |
| T11 | Bad data from the "API" | `TransactionSchema` parse at sync | `services/sync.ts` | Reviewer control "Bad data" |

**What this does not protect against.** The README says this in plain words.

| Item | Why |
| --- | --- |
| A rooted or instrumented device | The step-up result is a JS boolean. A hooked runtime can skip it. A production app would bind the key to biometrics or verify a signed challenge on a server |
| Amounts while shown | They sit in JS memory, the share sheet and the screen reader tree, and they stay shown after the next unlock until the user hides them. Masking protects the hidden state |
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
| Every state and event pair. `LOCK` during `authenticating` or `stepUp` is ignored | `features/auth/machine.test.ts` |
| Re-lock window (59 s stays, 61 s locks), idle lock | `features/auth/locks.test.ts` |
| Lock clears the cache and closes the database | `features/auth/session.test.ts` |
| Unlock opens History, and a lock unmounts it, which drops the draft with every protected route | `__tests__/lock-flow.test.tsx` |
| Step-up prompts every time with `'strong'`. A second call while prompting opens no second prompt | `features/auth/use-step-up.test.ts` |
| Showing prompts every time with `'strong'`. Cancel leaves amounts hidden. Hiding never prompts and drops the revealed queries, `clearPrefs` included. Shown amounts survive lock and unlock | `features/auth/amounts.test.ts` |
| Locked deep link renders Lock | `__tests__/guard.test.tsx` |
| Sync twice and interrupted give the same table hash. A page whose write fails keeps none of its rows. Bad rows are dropped and counted. A bank row never overwrites an added row | `services/sync.test.ts` |
| Search "entral" matches a JS filter on 10k rows. Masked reads hold no amounts, totals included. `%` and `_` match only themselves. Add is idempotent. Delete refuses bank rows. Undo restores the same row | `services/tx-repo.test.ts` |
| Seed is deterministic, valid, never in the future. Its newest rows are the boards' | `services/seed.test.ts` |
| Bank paging, faults, slow mode, one new row per refresh | `services/bank-api.test.ts` |
| Missing key resets the database, by the reset table. A busy disk wipes nothing. Key shape and storage options | `services/vault.test.ts` |
| Prefs read back, fall back to defaults, and notify on write and clear | `services/prefs.test.ts` |
| The logger takes an event code and nothing else | `services/logger.test.ts` |
| Haptics per platform, silent when the setting is off | `services/haptics.test.ts` |
| Log schema rejects amounts | `features/security/activity-log.test.ts` |
| Input limits, keypad cap, sanitiser | `models/draft.test.ts`, `features/add/keypad-reducer.test.ts`, `services/sanitize.test.ts` |
| Money: sign, split numerals, spoken amounts | `models/money.test.ts` |
| Integer sen at the storage layer. A repeated idempotency key is refused. `day` matches `malaysiaDay` | `services/db/schema.test.ts` |
| A masked query that selects an amount fails its parse | `services/db/rows.test.ts` |
| A root call never lands inside an open transaction. A failed savepoint undoes only its writes | `services/db/port.test.ts` |
| The key is the first statement on the device database | `services/db/expo.test.ts` |
| Release config always guards screens | `features/security/screen-guard.test.ts` |
| Selector and query benches on 10k rows within budget. They run alone and serially (`npm run test:bench`), because parallel workers inflate the timings | `*.bench.test.ts`, `services/tx-repo.bench.test.ts` |

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
