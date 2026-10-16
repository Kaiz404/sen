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
- `useRouteGate()` from `@/features/auth` returns one of three values: `'welcome'`, `'locked'` or `'unlocked'`. One value can't express "unlocked but never onboarded". The auth lane maps its reducer onto it: `authenticating` from locked stays `'locked'`, and `stepUp` is `'unlocked'`.
- `_layout.tsx` declares every route inside exactly one `Stack.Protected`, with all presentation options. A deep link whose guard is false lands on the first available screen. Only a detail link is held and opened after unlock (On `LOCK` below).
- `+not-found` sits in the unlocked guard. Its redirect home does nothing while home is guarded, so a locked unknown link falls through to Lock instead.
- The dev route is `dev/states`, not `(dev)/states`, because a group name never appears in the URL. In release `__DEV__` is false, so `sen://dev/states` lands on Lock.
- `src/__tests__/guard.test.tsx` renders the real layout over every route file on disk. A new route file is tested the moment it exists, because expo-router mounts an undeclared route outside every guard.

**Seams.** The root layout reads only seams, and their names are frozen. The bodies belong to the owning lane.

| Seam | From | Phase 1 body |
| --- | --- | --- |
| `RouteGate`, `useRouteGate`, `SessionRoot`, `LockScreen`, `WelcomeScreen`, `PrimerScreen` | `@/features/auth` | A module store that starts `'locked'`. The stub Lock calls `authenticateAsync` and unlocks. `SessionRoot` mounts the `QueryClientProvider` |
| `useSenMotionPreference` and the settings screens | `@/features/settings` | Returns `'full'` |
| `useScreenGuard` | `@/features/security` | Does nothing |
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
  | { kind: 'storage' } | { kind: 'unknown' }
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
| `errors.ts` | `AppError`, `isAppError`, `toAppError` (a full or failing disk is `storage`, anything else `unknown`), `isRetryable`, and `Result` as `{ ok: true; data } \| { ok: false; error }`. It uses `data` because lint bans `.value` |
| `prefs.ts` | `PREFS`, every MMKV key from DESIGN.md › Settings with its schema and default. `parsePref` never throws and falls back to the default |

Money output:

| Call | Result |
| --- | --- |
| `moneyParts(-231740)` | `{ sign: '−', currency: 'RM', whole: '2,317', fraction: '.40' }` |
| `moneyText(-4250)` | `−RM 42.50`, with U+2212 and a thin space after RM |
| `moneySpoken(-4250)` | `Minus 42 ringgit 50 sen`. The sen always gets its unit. Digits stay ungrouped so no screen reader says "comma" |

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
| `sync_state` | One row: the bank cursor and the last sync time. `meta` key `bank.feedEnd` is set in the transaction that commits the feed's last page and cleared by a bank reset | `id = 1` |
| `activity_log` | Security events | `meta` must be valid JSON. The `activity_log_cap` trigger keeps the newest 50 rows |
| `meta` | Key-value app state | `STRICT` |

Indexes: `tx_by_time (posted_at DESC, id DESC)`, which the keyset page query searches with no sort step, and `activity_log_by_time (at DESC, id DESC)`.

**Sync (D2).**
- **The bank.** `services/bank-api.ts` is an in-app mock with one endpoint, `fetchPage({ since, limit })`. It returns a `TransactionPageSchema` envelope whose items carry their feed `seq`, or a `Result` error of kind `offline`, `timeout` or `server`. `nextSeq` is null once a page reaches the end of the feed.
- **Seed (D5).** `services/seed.ts` builds the feed with mulberry32 (seed 57), oldest first, so `seq` grows with time. Sizes are 20, 1k (the default) and 10k. The bank builds a size's feed at its first request and keeps it, so the pages of one sync agree.
- **The boards' rows.** The newest 20 rows of every size are the boards' sample data: Tealive, the DuitNow from Aisyah Rahman, the Grab ride to KL Sentral, TNB electricity (RM 142.60, `FT26101400478213`), Shopee, the Touch 'n Go reload, GrabFood and the salary, then twelve rows for 1 to 12 Oct. With the boards' added row (Lunch with Hafiz, RM 42.50), 1 to 15 Oct sums to Money out RM 2,317.40 and Money in RM 6,850.00, as on SF-Reveal.
- **Dates.** The boards' "today" is today in Malaysia once 1:15 pm (the latest board row) has passed, and yesterday before that, so no row is ever in the future. The tail walks back about three rows a day for 1k (to Nov 2025 from 15 Oct 2026) and fourteen a day for 10k (to Sep 2024), with the salary on the boards' payday each month.
- **Reviewer faults.** A `BankScenario` (`next`, `size`, `slow`, `newOnRefresh`) shapes the bank's answers. `useSync` reads it from the `demo.*` prefs once per attempt, when `sync()` starts, and passes `bank.under(scenario)`, so every page of one request answers under the same scenario. `offline` and `server` fail the request at once, and `timeout` fails it after its 8 s deadline. `bad_data` adds two broken rows with no `seq` to every page, so the real rows still arrive. `slow` waits 3 s before each page.
- **One request per fault.** `next` is one-shot, as its label "Next history request" says. `useSync` reads it when a sync starts and sets it back to `normal` when that sync settles, so the fault covers every page of that one request and its automatic retry. A fault the reviewer picked while the request ran leaves that request whole, stays set, and fires on the next one. Real outages pass, so Retry recovering is the honest demo, and a reviewer never has to find the setting to get out.
- **New row on refresh.** With `newOnRefresh` on, a request past the end of the feed mints one pending row at now. So each refresh after a full sync brings exactly one row.
- **Upsert.** `sync(db, bank)` asks for pages of 500 after the saved cursor and parses each item on its own as a bank row (`source` must be `bank`). Each page upserts in chunks of 50 rows (`INSERT … ON CONFLICT(id) DO UPDATE … WHERE tx.source = 'bank'`) and saves the cursor (the highest item `seq`) and `synced_at`, all in one transaction. A sync that stops anywhere resumes from the last commit, and a second run converges on the same table. A bank row never overwrites a row added on the phone.
- **Reset under a running sync.** `sync` reads the cursor and `bank.generation` in one statement when it starts, and each page's transaction checks the generation again before it writes. A reset bumps it, so a sync that was mid-request when the rows were reset stops without writing and returns zero rows received. No page of the old feed lands in the new table, whoever called the reset, and the reset's own first sync fills it.
- **Results.** `sync` returns a `Result`. Transport errors pass through. A body that is not a page, or a page that asks for more without moving the cursor, is `server`. Bad rows are dropped and the good ones kept, and the result is `invalid_data` with the count.
- **Dataset switch.** `resetBank(db)` in `features/transactions/data.ts` runs `resetBankRows(db)`, which deletes bank rows, rewinds the cursor and bumps `bank.generation` in `meta` in one transaction, then invalidates `QK.tx`. Added rows stay. History runs its first sync again and the sync reports `onProgress(received)` after each page into `syncProgress`, which Settings reads with `useSyncProgress()`.
- **Catch-up on open (D34).** The first time the sync state is known on a History mount, a cursor above 0 with no `bank.feedEnd` (a first sync that was cut short) starts a quiet `catchup` sync. A finished history sends nothing on unlock. It slides nothing in and shows something only when it fails (the usual banner). The cursor and the upsert make a rerun safe, and a catch-up that fails leaves the flag unset so the next unlock tries again.
- **Pull-to-refresh.** Runs `sync()` through a TanStack mutation. Retries cover `offline` and `server` once, never `invalid_data`. A `timeout` is not retried, because the user has already waited its whole deadline.

**Reads (D3, D4).**
- **Module.** `services/tx-repo.ts`. Every function takes `db` first. A filter is `{ flow: 'all' | 'in' | 'out', search }`.
- **Pages.** `readPage` returns keyset pages of 100, newest first, on `(posted_at, id) < cursor`. It reads one extra row, so `next` is null on the last page. `useInfiniteQuery` loads the pages into FlashList.
- **Totals.** `readTotals` groups by `type` and `readDayNets` by `day`, newest day first, over a range of Malaysia days. The range becomes bounds on `posted_at`, so the page index serves it.
- **Search.** `LIKE` on `search_text`, with `\`, `%` and `_` escaped. `search_text` and the query both go through `searchKey` (cleaned, accents stripped, lower case). Search matches the description only. The input is debounced with `useDeferredValue`.
- **Detail.** `getTransaction(db, id)` is masked and `getRevealedTransaction` adds the amount. Both return null for a missing or unreadable row.
- **The detail screen.** `features/detail/detail-screen.tsx` parses the route id with `TxIdSchema.safeParse`, so a bad id is a missing row and never a throw. It reads the masked row under `['tx','detail',id]`. Only while shown does it read `getRevealedTransaction` under `['tx','revealed','detail',id]`, so hiding drops it with the other revealed reads. The amount reaches the receipt through `<RevealedAmounts>` and `useAmountView(id)`, the same path History's rows use, so it rolls in the same way. The screen maps the reads onto one union, `loading`, `missing`, `failed` or `found`. A missing, deleted or malformed id shows the not-found receipt with Back to history. A read that throws shows Couldn't load with Retry. Back goes home when nothing is behind the detail.
- **Copy reference.** `copySensitive(text)` in `services/clipboard.ts` calls the local module `modules/sen-clipboard` (D29), which marks the clip `EXTRA_IS_SENSITIVE` on Android and local only with a two-minute expiry on iOS. The key turns into "Copied" and a toast confirms for 2.5 s. A build without the module returns false, and the toast says to press and hold the reference, which is selectable.
- **Payment timeline.** `paymentSteps(row)` in `features/detail/receipt.ts` gives Authorised (done, at `postedAt`), Pending (now) and Posted (next) for a pending bank row, and null for a posted or added row. It shows while amounts show, as on SF-DetailRevealed. The bank sends no settle date, so Posted reads "NEXT" instead of the board's "BY FRI 16 OCT".
- **Share receipt.** The key shows only once the amount is in JS, and it hands React Native's `Share.share` the plain text from `shareText(row, amount)`: no image, no link, no balance. `shareText` takes the amount, so a hidden receipt has nothing to share. While hidden the footer says "Show amounts to share this receipt."
- **Writes.** `insertManual(db, draft, now)` stores a draft as `m-<idemKey>` with a `SEN-M-` reference made from the key, at the current Malaysia time of day on the chosen day. A repeated `idemKey` writes nothing and returns the stored row with `created: false`. `deleteManual` returns `deleted`, `missing` or `read_only` (bank rows).
- **Undo.** `deleteManual` keeps the deleted row as JSON in `meta` (`undo.deleted`), and `restoreDeleted` moves it back. Both run in SQL, so undo never brings the amount into JS. `eraseManual` deletes every added row and the undo copy in one transaction, and `countManual` counts them for the Erase sheet and the Settings row.
- **Freshness.** The one write module calls `invalidateQueries(['tx'])` after every commit.
- **History.** `features/transactions/data.ts` holds every History read under `QK.tx`: the pages per filter, `sync-state`, and counts per filter and day range. `placeholderData: keepPreviousData` keeps the last list on screen while a new filter loads, so typing never flashes the skeleton.
- **Rows as data.** `buildHistoryRows(rows, { today, complete })` turns the loaded rows into one flat list of `day`, `tx` and `net` items, a discriminated union, with every `day` index sticky. A day's slip closes with its `net` only when all its rows are loaded: an older day follows it, or no page is left. Order alone proves that, so the masked day counts are not read. `toRowView` caches one view per row object in a `WeakMap`, so a row the query cache hands back unchanged keeps its view and its memoised row skips the render (`rows.test.ts`).
- **The month card.** It counts the month so far, the 1st to today in Malaysia time, under the In and Out filter but not the search. A search swaps the card for a result line with the count and the net over all history.
- **The screen's state.** `historyBody()` in `body.ts` maps the first page, whether `sync_state` has a cursor, the sync mutation and the filter onto one union: `loading`, `failed`, `empty`, `no-results` or `list`. A rejected page or sync-state read is `failed` with `unreadable`, drawn like the sync errors with a Retry that reads again, so no read failure leaves the skeleton up. `syncNotes()` adds the banner over a list and the unreadable count (`body.test.ts`).
- **First sync.** It runs once each time `sync_state` has no cursor: at the first unlock, and after each `resetBank`. A first sync that failed waits for Retry. A first sync cut short (cursor above 0, no end of feed) is finished by the catch-up on the next History open. Later syncs run only on pull, Retry, or the banner's Retry. Every sync settles with `invalidateQueries(QK.tx)`.
- **The bank.** One `createMockBank` in `data.ts` reads `demo.next`, `demo.datasetSize`, `demo.slow` and `demo.newOnRefresh` through `readPref` before each request.
- **Measured.** A Jest bench on 10k rows (seed 57), `node:sqlite` on WSL, 50 runs after 5 warm-up, p95: first page 2.9 to 5.0 ms, a page after row 5,000 3.5 to 4.9 ms, month counts or sums 0.1 ms, 7-day nets 0.1 to 0.6 ms, 300 revealed amounts 1.0 to 2.2 ms, search "entral" page and count 5.7 to 6.4 ms. A full sync of 10k rows took 325 to 386 ms. These are desktop numbers, not phone numbers. On a page, the SQL alone is 0.7 to 1.2 ms at p50, so parsing 100 rows with zod is about two thirds of the time.

**Masking (D6).**
- **Masked queries.** `readPage`, `readTotals`, `readDayNets` and `getTransaction` never select `amount_minor`. Masked totals and day nets return counts only. Every function that returns an amount has `Revealed` in its name.
- **Shown or hidden.** The session store's `amountsHidden` flag decides (D27). It starts true at every launch and goes true again whenever the database closes, so every unlock and cold start lands masked. Nothing is saved. Showing goes through `useStepUp('reveal')`. Hiding never prompts.
- **On show.** `readRevealedAmounts(db, { filter, through })` loads `id → amountMinor` for the loaded rows, from the newest down to the last loaded row, keyed `['tx','revealed',…]`. `readRevealedTotals` and `readRevealedDayNets` add sums and nets. Every revealed query is `enabled` only while shown. The screen gathers them into one `Revealed` value (amounts, day nets, month totals, result totals), which is null while hidden, and hands it down through `<RevealedAmounts>`. Rows read it through `useAmountView(id)` and day nets through `useDayNetView(day)`. Both return `null` while masked. The list's `data` never changes on show or hide, by identity (`masking.test.tsx`).
- **On hide.** `removeQueries(['tx','revealed'])`. Lock also clears it with the whole cache.
- **Honest limit.** While revealed, amounts sit in JS memory. While masked, no amount read from the database exists in JS. The mock bank is the exception. `services/bank-api.ts` keeps its whole feed, amounts included, in JS memory for the life of the app, because it stands in for a server. A real bank's feed would live on that server.

## State

**Session.**
- **Reducer.** A pure reducer in `features/auth/machine.ts`, a discriminated union with an exhaustive `switch`, no timers and no I/O. An event that does not apply returns the same object, so the store skips the notify.
- **Store.** A Zustand store in `features/auth/session.ts` wraps it. `dispatch` runs the reducer, then the effects of the transition (On `LOCK`).
- **React.** Components select narrow slices. Rows never subscribe to the session.
- **Outside React.** AppState, the tick and the actions read `sessionStore.getState()`.
- **Amounts are in the session store, not the machine.** Whether amounts show is `amountsHidden` beside `lockoutArmed` in `sessionStore` (D27). It is not a pref, so it can't outlive a lock or a process. See Showing and hiding amounts below.

**The open database.** The states with an open vault (`arriving`, `unlocked`, `stepUp`) carry the one `OpenDb`, so "unlocked with no database" can't be written down. `openVault()` gives it on unlock and the store closes it when the session leaves the unlocked states. Screens read it with `useDb()` from `@/features/auth` and pass it to service functions, which never hold one. A screen still animating out after a lock keeps the closed handle, so a late query rejects with "The database is closed." instead of the screen throwing (inferred: react-native-screens keeps a closing screen mounted for its exit animation).

**Screen-local state.** Search text, filter and the add draft stay in `useState` or `useReducer` in their screen. The draft lives in memory only.

```
 launching ──LAUNCHED, no vault──► welcome ◄──────────────── SIGN_OUT_DONE ──────────────┐
     │                              │   ▲                                                 │
     │                   AUTH_START ▼   │ AUTH_FAIL                                       │
     │                     authenticating{setup}                                          │
     │                              │ UNLOCK_OK                                           │
     │                              ▼                                                     │
     │                      arriving{purpose, since, db}                                  │
     │                              │ ARRIVED                                             │
     │                              ▼                                                     │
     │                      unlocked{since, db} ◄── STEP_UP_DONE ──┐                      │
     │                         │        │                          │                      │
     │                    LOCK │        └── STEP_UP_START ──► stepUp{action, returnTo}    │
     │                         ▼                                                          │
     └──LAUNCHED, vault──► locked{reason} ──SIGN_OUT_START──► signingOut ─────────────────┘
                              │   ▲  ◄──── SIGN_OUT_FAIL ────────┘
                   AUTH_START ▼   │ AUTH_FAIL
                    authenticating{unlock} ──UNLOCK_OK──► arriving ──ARRIVED──► unlocked

 unlocked also takes SIGN_OUT_START to signingOut. arriving also takes LOCK to locked.
```

| Event | From | To |
| --- | --- | --- |
| `LAUNCHED` | `launching` | `locked{launch}` with a vault, `welcome` without |
| `AUTH_START` | `welcome`, `locked` | `authenticating{setup}`, `authenticating{unlock}` |
| `UNLOCK_OK` | `authenticating` | `arriving{purpose, since, db}` |
| `ARRIVED` | `arriving` | `unlocked{since, db}` |
| `AUTH_FAIL` | `authenticating` | Back to `welcome` or `locked{reason}` |
| `STEP_UP_START` | `unlocked` | `stepUp{action, returnTo}` |
| `STEP_UP_DONE` | `stepUp` | `returnTo`, or `locked{lockPending}` when a lock arrived meanwhile |
| `LOCK` | `unlocked`, `arriving`, `stepUp` | `locked{reason}`, or `stepUp` with `lockPending` set (the first reason is kept) |
| `SIGN_OUT_START` | `locked`, `unlocked` | `signingOut` |
| `SIGN_OUT_DONE` | `signingOut` | `welcome` |
| `SIGN_OUT_FAIL` | `signingOut` | `locked{signout}` |

Every other pair returns the state unchanged. `machine.test.ts` checks all 120 pairs.

| State | Holds | Gate | Routes allowed |
| --- | --- | --- | --- |
| `launching` | Nothing. The splash stays up | `locked` | `lock` |
| `welcome` | Nothing. No vault yet | `welcome` | `welcome`, `primer` |
| `locked` | `reason`: launch, idle, background, manual, signout (a sign-out that failed) | `locked` | `lock` |
| `authenticating` | `purpose`: `unlock` from Lock, or `setup` from the primer | `locked` or `welcome` | Current screen stays |
| `arriving` | `purpose`, `since`, `db` | `locked` or `welcome` | Current screen stays while Sen plays Unlock |
| `unlocked` | `since`, `db` | `unlocked` | All protected routes. Amounts follow `amountsHidden`, which is true on every arrival |
| `stepUp` | `action`, `returnTo` (the unlocked state, `db` included), `lockPending?` | `unlocked`, or `locked` when `lockPending` is set | Current screen stays |
| `signingOut` | Nothing. The vault is being destroyed | `locked` | `lock`, with every key disabled |

- **Launch.** `SessionRoot` runs `hasVault()` and `detectBiometric()` once. No vault goes to Welcome. A vault, or a failed check, goes to Lock, so Welcome never opens over existing data. The native splash (plain ink) stays up until `LaunchCover` covers the first screen with the MAL2 launch, so the hand-over can't be seen. Lock and Welcome report their hero's box from `onLayout` (`reportLaunchTarget` in `launch.ts`; the hero sits at the window's top left). A first screen with no hero in 500 ms, such as a dev deep link, skips the launch and lifts the splash. The launch plays once per process.
- **Unlock.** `unlock(arriveAfterMs)` prompts, then calls `openVault()`. Success enters `arriving`, which keeps the asking screen (Lock or the primer) routed while its Sen plays the Unlock moment, and `ARRIVED` opens History after `arriveAfterMs` (DESIGN › Flows: "Unlock moment, then History"). `useHistoryPrefetch()`, called by the root layout, subscribes through `onArrive(listener)` and starts History's opening reads on `UNLOCK_OK` (the first page, the sync state and the month card's totals), with the same query options History mounts with. The hold then overlaps the data load instead of adding to it. History reads the rest (revealed amounts and day nets) once the first page is in. A lock in that window closes the vault, and the late `ARRIVED` does nothing. A `reset` result leaves a `db_reset` notice that History reads with `useDbResetNotice()` and clears with `dismissDbResetNotice()`. A vault that fails to open returns to Lock with the generic error.
- **Sign out.** `signOut()` serves Settings and "Not you? Start again" on Lock. It enters `signingOut`, waits for the database to close, calls `destroyVault()` (which also clears prefs), then shows Welcome. Only `SIGN_OUT_DONE` or `SIGN_OUT_FAIL` leaves `signingOut`, so an unlock, a lock or a tap during the erase does nothing. A failure returns to `locked{signout}` and Lock shows the generic error.
- **Biometric name.** Copy names the device's own biometric: Face ID or Touch ID on iOS, fingerprint or face unlock on Android, from `supportedAuthenticationTypesAsync()`. `ready` is a strong biometric enrolled (`getEnrolledLevelAsync()`). When it is false, Lock and the primer open on "is off".
- **Exports.** `useRouteGate`, `onArrive`, `useDb`, `useStepUp`, `useAmountsHidden`, `showAmounts`, `hideAmounts`, `useDbResetNotice`, `useBiometric`, `lockNow`, `signOut`, `armLockout`, `disarmLockout` and `useLockoutArmed` (the reviewer lockout control, a `lockoutArmed` flag in the session store that the next `unlock()` consumes by reporting `lockout` without prompting), `dismissDbResetNotice`, and the dev-only `setAuthOverride` and `isAuthOverride`. The screens export a prop-driven view next to each container (`LockView`, `PrimerView`, `WelcomeView`) for the gallery.

**Showing and hiding amounts (D27).** `features/auth/amounts.ts` owns the behaviour. The value is `amountsHidden` in `sessionStore`, not a pref.
- **Session state, not a pref.** A pref would persist the reveal across lock and process death, and the cold start would need a write to undo it. An in-memory flag starts true at launch, so a cold start is masked by construction, and the close path in `dispatch` resets it. This is the conventional session-scoped reveal (inferred, not surveyed). No code reads or writes an amounts key in MMKV. An upgraded device keeps the `hideAmounts` value an earlier build wrote until sign-out clears prefs, and nothing ever reads it.
- `useAmountsHidden()` selects the flag from the store, so Settings' switch, History, Detail and the delete sheet all follow it.
- `showAmounts()` runs step-up `reveal` and sets `amountsHidden: false` only when the check passes. A cancel changes nothing and says nothing. Any other refusal shows a toast with `refusalText()` (`features/auth/copy.ts`).
- `hideAmounts()` sets it back to true and never prompts.
- **Re-hide on lock.** `dispatch` sets `amountsHidden: true` in the same `setState` that leaves the unlocked states, next to `queryClient.clear()`. Idle, background, manual and sign-out all pass through it. A cold start needs nothing, because the store's initial value is true.
- Lint bans any `amountsHidden` property whose value is not the literal `true` (`false`, a variable, shorthand, a quoted key) outside `amounts.ts` and tests, so no other code can show amounts without step-up. A computed key such as `[name]: false` is not caught.
- `SessionRoot` runs `dropRevealedOnHide()`. Whenever `amountsHidden` turns true, it runs `removeQueries(['tx','revealed'])`. Masked pages stay cached.
- Lock and the primer always say "Amounts stay hidden until you choose to show them."
- The month card's Sen (`id="month"`) rests `masked` or `revealed` with `amountsHidden`, so showing plays Reveal and hiding plays Re-mask. A lock unmounts History and the next unlock mounts it masked, so a Sen starts in `masked` and Re-mask does not play on unlock (`src/__tests__/lock-flow.test.tsx`). History fires Reveal's success haptic itself when the check passes, and the moment carries none, because a scroll or the background can hold the moment back and the buzz must still come once. "Hide amounts" fires the light `hideNow` haptic itself too, as DESIGN says.

**Sen on Lock and the primer.** Each screen names its Sen to the director (`lock`, `primer`; Lock's napping Sen shares `lock`, since the two never show together). The container holds its prompt as `notAsked`, `asking` or `answered` with the `AuthOutcome` that `unlock()` returned, and an optional `rest` loop for an answer with no moment of its own. `usePromptMoments(sen, prompt, answers)` in `screens/prompt-moments.ts` plays from that, never from a diff of the view, so a cancel that leaves the view as it was can't replay the last answer.

| Prompt | Moment |
| --- | --- |
| `asking` | `faceScan`, the 1.6 s peek loop while the prompt is open |
| Answered `ok` (the session is `arriving`) | `unlock`. The screen holds `UNLOCK_HOLD[level]` (1370 ms in Full, 400 ms in Calm and Off), then History opens |
| Answered `mismatch` | `authFailed` |
| Answered `lockout` | `lockout`, then `lockoutBreathe`. Lock only. The primer's Sen keeps peeking |
| Any other answer (a cancel, off, error) | Stops the scan, and Sen settles into the state's pose. After a miss that is `worried`. While the lockout card still shows, the answer carries `rest: 'lockoutBreathe'`, so the napping Sen breathes again after a passcode cancel |

- A screen that has not asked plays nothing, and the prop-driven views (`LockView`, `PrimerView`) play nothing, so the gallery draws each state still.
- The container shows `checking` until the answer lands (`asking`), because the session leaves `authenticating` a render before the answer reaches the screen. Without it the view would flash `idle`.
- Lock's Sen idles masked, so it peeks toward Unlock every 6 to 9 s (`lockPeek`).

**Step-up.** `useStepUp(action)` returns a function. Each call prompts and resolves to `{ ok: true } | { ok: false; reason }`, with `reason` one of `cancelled`, `mismatch`, `lockout`, `not_set_up`, `unavailable` or `unknown`. Nothing is cached, so every write prompts. A call while another prompt is up resolves `cancelled` without a second prompt.

| Action | Prompt | On success | On cancel |
| --- | --- | --- | --- |
| `reveal` | "Show amounts" | `showAmounts()` sets `amountsHidden: false`, then an `amounts.revealed` entry | Stay hidden, silently |
| `add` | "Save this transaction" | DB write, then a `tx.added` entry (only for a new row, not a repeated save) | "Not saved. Your draft is still here." |
| `delete` | "Delete this transaction" | DB delete, then a `tx.deleted` entry | Sheet stays, silently. Any other failure says "Nothing was deleted." |
| `clearLog` | "Clear security activity" | Log cleared, one `log.cleared` entry left | Nothing. A mismatch says "The log is as it was." |
| `erase` | "Erase transactions I added" | Every added row and the undo copy deleted in one transaction, a `tx.erased` entry with the count, History refreshed. Bank rows, vault, key and prefs stay | The sheet stays. A mismatch says "Nothing was erased." A check that is off or unavailable offers "Open device settings". A failed delete says "Nothing was changed." |

The writes and logs belong to the callers. Undo inside the 6 s toast skips the prompt. It only reverts what the user just authorised, and it logs `tx.undone`. A step-up that reads `mismatch` or `lockout` logs `auth.failed`. A cancel logs nothing. A step-up that ends in a lock that arrived during the prompt returns `cancelled` and logs no failed check, whatever the prompt answered. The lock is the event, and it logs `lock.locked` when it applies.

**`authenticateAsync` options.** One path, `authenticate()` in `features/auth/prompt.ts`, serves unlock and step-up.
- `biometricsSecurityLevel: 'strong'`.
- `disableDeviceFallback: false`.
- `isAuthenticatingRef` is set before the prompt and cleared in `finally`. A prompt requested while it is set resolves `cancelled`.

| Module state | Values | Set by | Read by |
| --- | --- | --- | --- |
| `authOverride` in `prompt.ts`, dev builds only | `real` (default), `pass`, `fail`, `cancel`, `lockout`. Each stands in for the native result (`success`, `authentication_failed`, `user_cancel`, `lockout`), so the `FAILURE` table and `isAuthenticatingRef` still apply | `setAuthOverride()`, called by the gallery for `sen://dev/states?auth=<value>` | `authenticate()`, in place of `authenticateAsync`. Memory only, so a reload returns it to `real` |

How the first two combine on a phone with only weak biometrics isn't documented, so it gets tested on a device.

**Error codes.** The table `FAILURE` in `prompt.ts` types every `LocalAuthenticationError`, so a new code fails `tsc`. The native code is untrusted input. expo-local-authentication 57.0.3 on iOS also returns `unknown: <code>, <message>` and `missing_usage_description` (V, `LocalAuthenticationModule.swift`), so any code not in the table maps to `unknown`.

| Codes | Reason | Lock and primer UI |
| --- | --- | --- |
| `user_cancel`, `system_cancel`, `app_cancel` | `cancelled` | Return silently. Not an error |
| `user_fallback` | `cancelled` | Sen always allows the passcode, so the OS handles it. Treated as a cancel |
| `authentication_failed` | `mismatch` | "Not quite." with "2 more tries before fingerprint locks". Three tries are shown (inferred). At zero it points to the passcode |
| `lockout` | `lockout` | "Too many tries." with a 30 s cool-down card (Android's lockout length, inferred), and the passcode |
| `not_enrolled`, `passcode_not_set` | `not_set_up` | "Fingerprint is off." Open device settings, or the passcode |
| `not_available` | `unavailable` | Explain, passcode |
| `no_space`, `timeout`, `unable_to_process`, `invalid_context`, `unknown`, and any code not in the table | `unknown` | "Something went wrong." Generic retry |

**Android and a wrong finger.** expo-local-authentication 57.0.3 on Android keeps BiometricPrompt open on a failed match and never resolves `authentication_failed` (V, `LocalAuthenticationModule.kt` maps only `onAuthenticationError`). The system sheet shows the miss itself. "Not quite." appears on iOS, where LocalAuthentication reports the failure. On Android it shows only through the dev override `auth=fail`, which `.maestro/auth-mismatch.yaml` uses.

**Lock triggers** (`features/auth/locks.ts`, wired by `SessionRoot`).

| Trigger | Mechanism |
| --- | --- |
| Background | AppState `background` stores `backgroundedAt`, every time. It does not hide amounts. The lock that follows (D27) does |
| Return | `lockIfAwayTooLong()` locks if `now − backgroundedAt > relockAfter`, or if `now` is before `backgroundedAt` because the clock was set back. It runs on `active`, and before that on a `url` event, because both platforms deliver a link before the app turns active (inferred: Android calls `onNewIntent` before `onResume`, iOS `openURL` before `didBecomeActive`). Never auto-prompt |
| Idle | `onTouchStart` on the `SessionRoot` view resets `lastTouch`, a plain module variable. A 15 s tick compares it with `idleLock`, and a `lastTouch` in the future (a clock set back) counts as idle. The tick skips while backgrounded, and `active` restarts the count |
| Manual | "Lock now" calls `lockNow()` |

**The iOS inactive trap.** The Face ID sheet itself sends the app to `inactive` and back. So:
- Only `background` starts the re-lock window. `inactive` only shows the privacy cover, which the security feature owns.
- A prompt still open on `active`, such as a passcode screen that leaves the app, cannot lock mid-prompt. The reducer records the lock as `lockPending` on `stepUp` and applies it when the prompt ends, whatever the outcome, so a long absence is never forgotten. `stepUp()` then returns `cancelled`, so the action it guarded does not run on a closed database. A prompt the OS cancelled on the way out, such as Home on a step-up sheet, leaves the window running.
- The reducer ignores `LOCK` while in `authenticating`, and defers it while in `stepUp`, so an idle tick never cuts a prompt short.

**On `LOCK`, and on any move out of the unlocked states, sign-out included:**
- `queryClient.clear()`.
- Hide the current toast. `<ToastHost />` sits outside the guarded routes, and the undo toast carries transaction text.
- Close the database.
- Drop the draft. Protected routes, which include every sheet and the add flow, unmount. A draft with input sets `draftDropped` as the add flow unmounts under the lock, and History shows "Sen locked while you were adding. Nothing was saved." once after the next unlock.
- Set `amountsHidden` back to true, in the same `setState` as the move. This one place covers idle, background, manual and sign-out locks. The next unlock lands masked and showing asks for biometrics again.

**Held detail link** (`features/auth/held-link.ts`). A deep link that arrives while locked lands on Lock. If it is a detail link in the app's own scheme (`sen://transaction/<id>`, never `https://transaction/<id>`), its path is held, and `HeldLinkOpener` in `SessionRoot` pushes it once the gate turns `unlocked`, over History, so Back goes home.

| Case | What happens |
| --- | --- |
| Cold start with a vault | `Linking.getInitialURL()` gives the link. The router lands on Lock, the link is held, and the receipt opens after unlock |
| Running and locked (since launch, idle or Lock now) | The `url` event finds the gate locked. The router lands on Lock, and the link is held |
| Back from the background past `relockAfter` | The `url` event runs `lockIfAwayTooLong()` before it weighs the link, so the app locks first and the link is held. Lock shows on `active`. If the router's listener runs first, it opens the receipt while the app is still in the background, and the lock unmounts it (inferred) |
| Back from the background inside `relockAfter` | Nothing locks. The router opens the receipt, and nothing is held |
| Welcome and sign-out | Nothing is held while the gate is `welcome` or a sign-out runs, and a held link is dropped the moment either starts. This covers a link that lands on Welcome, a cold-start link that resolves before or after the launch finds no vault, and a sign-out that fails back to Lock. The next unlock is a new user's, so it never opens the last one's link |

The newest link wins, and any other link drops the held one, so a link can never open a sheet or a setting after unlock. A link that arrives while unlocked is the router's alone. The detail screen still parses the id, so a stale or bad link shows not found.

## Errors (D15)

**Tagged unions.**
- Pure and service code returns a small local `Result`.
- `queryFn` and `mutationFn` throw the tagged value.
- `Register.defaultError` types `error` as `AppError` everywhere.

**Unexpected bugs.** They reach a route `ErrorBoundary` that shows Sen and a retry and never renders `error.message`.

| Source | Kind | UI |
| --- | --- | --- |
| Sync, no local rows | `offline`, `timeout`, `server` | Full error card with Retry, and a "Reviewer settings" link because the fault is simulated |
| Sync, local rows exist | `offline` | Calm banner over the list with the last sync time |
| Sync, local rows exist | `timeout`, `server` | Banner, list kept, Retry |
| Any of the three | | The banner's "Simulated · Change in Settings" line and the full error's link open Settings at the reviewer controls (`/settings?focus=reviewers`) |
| Sync | `invalid_data` | List shown, "2 items couldn't be read" |
| Sync, a throw that is not an `AppError`, from a full or failing disk (SQLITE_FULL, SQLITE_IOERR, ENOSPC) | `storage` | `toAppError()` maps it at the mutation, and `bank.under()` throwing is caught there too. Full error "Can't save to this phone" with Retry, or a banner "Sen couldn't save to this phone. Free some space, then try again." over a list. Neither mentions the reviewer controls, because the fault is real |
| Sync, any other throw | `unknown` | Full error "Something went wrong" with Retry, or a banner "Sen couldn't refresh. Something went wrong. Try again." over a list. No storage advice and no reviewer link. The log gets `sync.failed.unknown` and nothing from the error |
| Database read | `unreadable` (a body state, not an `AppError`) | Full error "Sen couldn't read your history" with a Retry that reads again |
| Database | `db_reset` | One-time notice |

## Settings and reviewer controls

`features/settings/` draws one screen from the prefs and three sheets. DESIGN › Settings lists the rows.

- **Reads.** `usePref(key)` reads one pref through `useSyncExternalStore` on `subscribePrefs`, so a write from anywhere shows at once. A fault that turns itself off after its request reads Normal on an open Settings screen.
- **Writes.** Plain prefs (`theme`, `idleLock`, `relockAfter`, `senMotion`, `haptics` and the `demo.*` switches) go straight through `writePref`. Hide amounts goes through `showAmounts()` and `hideAmounts()`, so showing still needs step-up. The dataset size runs `switchDataset`, which runs `resetBank(db)` and writes the pref once the bank rows are gone, before History syncs again. A failed reset keeps the old size over the old rows. It does nothing while a sync runs.
- **Theme.** `features/settings/theme.ts` is the first import of `index.ts`. It reads the `theme` pref from MMKV, synchronously, and calls `configureThemes` in `theme/unistyles.ts`, which hands Unistyles `initialTheme` for Light or Dark and `adaptiveThemes` for System. So the first frame already wears the saved theme. The module then subscribes to the pref, and every write calls `applyTheme`: `setAdaptiveThemes(true)` for System, or `setAdaptiveThemes(false)` and then `setTheme`, since Unistyles refuses `setTheme` while adaptive themes are on. The theme switches with no restart, and sign out's `clearPrefs` returns it to System.
- **Simulate lockout.** `armLockout()` sets `lockoutArmed` in the session store, and the next `unlock()` returns `lockout` without opening the prompt. Tapping again, or the toast's Undo, calls `disarmLockout()`. Reset demo data disarms it, and so does a sign out that succeeds, so the next demo user never meets a lockout they did not arm.
- **Reset demo data.** `resetDemo(db)` runs `resetBank(db)` and, once the bank rows are gone, writes every `demo.*` pref back to its default and disarms the lockout. A failed reset changes nothing, so the sheet's "Nothing changed" is true. Security prefs and added rows stay. The sheet then goes back to History, which loads the sample rows again.
- **Sign out.** The sheet calls `signOut()`. A failure lands on Lock with a toast, and Lock's "Start again" tries again.
- **Focus.** `/settings?focus=reviewers` opens the screen scrolled to the reviewer slip. It scrolls on the slip's first layout only, so a later layout, such as a row growing, never pulls the user back. History's fault states link there.
- **Views.** `SettingsView`, `PrivacyView`, `SignOutView` and `ResetDemoView` take props only, so the gallery draws every state from fixtures.

**In release builds.** The reviewer controls ship in the release APK, unlike the dev auth override (T12). They are safe there because of what they can reach. The `demo.*` prefs only shape the answers of the in-app fake bank, which stands in for a server, and every answer still goes through the same zod parse at sync (T6, T11). The lockout control can only make an unlock fail. None of them can pass a biometric check, show an amount, skip step-up or open a protected route. They live in `features/settings/`, `features/transactions/data.ts` and the session store, and never call `setAuthOverride`, so `npm run release:auth-check` still finds the override compiled out.

## Storage and keys

| Store | Holds | Protection |
| --- | --- | --- |
| `sen.db` (SQLCipher) | Bank rows, added rows, sync cursor, activity log | AES-256, whole file |
| SecureStore `sen.dbKey.v1` | 32 random bytes as 64 hex characters, applied as a raw key (`PRAGMA key = "x'…'"`) so open skips PBKDF2 (V) | Keychain or Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| MMKV `prefs` | theme, `idleLock`, `relockAfter`, `senMotion`, `haptics`, `demo.*` | None. Nothing sensitive |

**Key.** 32 bytes from `expo-crypto` `getRandomValues`, stored as 64 hex characters. Read, write and delete all pass `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so the key is readable only while the phone is unlocked and is never restored to another device (V). A new key is stored only after its database opened, so a failed first open leaves no orphan key.

**Vault.** `services/vault.ts` exposes `hasVault()` (a valid key and its database file both exist), `openVault()` and `destroyVault()`. `createVault(ports)` holds the logic. SecureStore, the database file, random bytes and prefs sit behind `VaultPorts`, so the tests run the rules on fakes.

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
| Sign out | The caller closes the database. A close that rejects is logged and does not stop sign-out, because the key goes first. `destroyVault()` deletes the key first, so the file is unreadable even if deleting it fails, then deletes the file (one already gone is fine) and clears prefs |
| Erase | Step-up, then `eraseManual` deletes the added rows. The vault, key and prefs stay (D31) |
| App returns to the front | `refreshBiometric()` re-reads the enrolled level, so a fingerprint turned on in the phone's settings clears Lock's "off" view without a restart |
| Key present, database missing | An iOS reinstall, because Keychain items survive app deletion. The key is an orphan. `hasVault()` and `openVault()` delete it, so launch shows Welcome and the next open creates a fresh database with a new key. The file check is `File(Paths.document, 'SQLite', 'sen.db').exists` from `expo-file-system`, the directory expo-sqlite uses on both platforms (V, native source) |
| Key missing, database present | Backup restore or reinstall. Unreadable by design. Delete it, start clean, show `db_reset` (`missing_key`) |
| Database unreadable or newer than the app | Same, as `corrupt`. Unreadable means SQLite code 26 (wrong key, foreign file) or 11 (damaged page) |
| Vault will not open (disk full, failed migration, key store unreadable) | `unlock()` returns `{ reason: 'store', cause }` with `cause` `full`, `key` or `store` (`services/store-fault.ts`), logs `vault.open_failed.<cause>`, and returns to Lock. Lock shows the `store` view that names the cause. From the second failure in a row it offers "Reset Sen on this phone" behind a confirm, which runs `signOut()`. A full disk never offers the reset, because freeing space fixes it |
| One bad row | Drop it, count it, show "1 item couldn't be read" |

**Activity log (D31).**
- **Rows.** At most 50 `{ id, at, code, meta }`, kept by the `activity_log_cap` trigger. `id` is the time plus a counter, so events that share a millisecond keep their order.
- **The shape.** `models/activity.ts` holds `ActivityEventSchema`, a strict union per `code`. No code has a numeric amount field and an extra key is refused on write and on read. A row that no longer parses is skipped and counted.
- **Codes.** `auth.unlocked`, `auth.failed` (`mismatch` or `lockout`), `lock.locked` (`idle`, `background` or `manual`), `amounts.revealed`, `amounts.hidden`, `tx.added`, `tx.deleted`, `tx.erased` (a row count), `tx.undone` (`add` or `delete`), `settings.weakened` (the idle or leave window got longer), `demo.reset` and `log.cleared`. Each is also a logger code, checked by a type.
- **Writing.** `services/activity-log.ts` holds `insert`, `readActivity`, `clearActivity` and a recorder. `record(db, event)` writes at once. `record(null, event)` holds the event (at most 50) for `flush(db)`, which `unlock()` runs after the vault opens. `flush` writes the held events in one transaction. A lock closes the database through the same first-in, first-out queue the writes joined, so the close runs after every write already started. `settled()` is for tests, which wait on it before they read. A failed write logs `activity.write_failed` and never throws to the caller.
- **Callers.** The session store records unlocks, failed checks, locks and holds. A lock is recorded in `dispatch`'s close path when it applies, so a lock that waited for a step-up prompt logs once, after the prompt. `showAmounts` and `hideAmounts` record reveals and hides (a hide only when amounts were showing). The add actions record add, delete and both undos with the description. Settings records a longer idle or leave window and a demo reset.
- **Reading.** `ActivityScreen` reads the log with TanStack Query (`['activity']`, refetched on mount), groups it by Malaysia day, and clears it behind `clearLog` step-up.
- **Gone with the vault.** Sign-out destroys the log and drops any held events. Erase leaves the log and adds one `tx.erased` entry.
- **Descriptions stay.** A deleted or erased row's description stays in its `tx.added` and `tx.deleted` events until the 50-event cap drops them or the log is cleared. A label is cut to the description limit (`ACTIVITY_LABEL_MAX`, from `DRAFT_LIMITS`), so a long one never costs the event.

**Backups.**
- **Android.** `android.allowBackup: false` (its default is `true`, V). On Android 12+ some devices still run device-to-device transfer with it, so `plugins/with-no-backup.js` also writes `sen_data_extraction_rules.xml` (`<cloud-backup>` and `<device-transfer>`) and `sen_backup_rules.xml` (Android 11 and lower), each excluding every domain, and points the manifest at them. `expo-secure-store` runs with `configureAndroidBackup: false` so its narrower rules don't compete. A native rebuild with prebuild applies it.
- **iOS.** A restored database has no key, because the key is `THIS_DEVICE_ONLY`. So it is reset on first unlock (I).

## Add form input

| Field | Rule | Where |
| --- | --- | --- |
| Amount | Integer sen, 1 to 5,000,000 (RM 0.01 to RM 50,000.00) | `models/draft.ts` |
| Keypad | Digits shift in from the right. Keys 1 to 9, 00, 0 and delete. A key that would make an eighth digit does nothing. No decimal key | `features/add/keypad-reducer.ts` |
| Direction | `'debit' \| 'credit'`. The sign is never typed | `models/draft.ts` |
| Description | Cleaned, then 2 to 60 characters. NFC, control, zero-width and bidi characters removed, spaces collapsed, trimmed. The draft keeps the text as typed. The counter, the preview, the review and the stored row read it through the sanitiser, and the field shows the cleaned text when editing ends | `services/sanitize.ts`, `features/add/draft.ts` |
| Description input | `autoCorrect={false}`, `autoComplete="off"`, `spellCheck={false}`, `textContentType="none"`, `importantForAutofill="no"`, `maxLength={60}` | `features/add/details-step.tsx` |
| Category | Enum of eight | `models/category.ts` |
| Date | Today, Yesterday, or a list of every day back to 90 days ago. Never future | `models/draft.ts`, `features/add/details-step.tsx` |

**Why a custom keypad.** No amount ever reaches a keyboard that learns, suggests or syncs. The input space is exactly ten digits and delete.

**The draft.** `AddLayout` holds one `DraftInput` in a reducer (`features/add/draft.ts`) and hands it to the three steps through context. It is memory only. Lock unmounts every protected route, so the draft drops with it. `toDraft` parses it with `draftSchema(today)` into the `Draft` the repo stores, or returns null.

**Closing.** Close with input (an amount, a description or a category) shows "Discard this draft?". So does Android's back key on the amount step. Back on the later steps returns a step and keeps the draft.

**Saving.** The review is a union: `ready`, `checking`, `refused` with the step-up reason, or `failed`. A save that lands leaves the screen.
- The Save key disables before the prompt, and a ref drops a second tap that lands in the same frame.
- `saveDraft` in `features/add/actions.ts` runs step-up, then `insertManual`, then `invalidateQueries(QK.tx)`.
- A cancel shows "Not saved. Your draft is still here." and writes nothing.
- A write that throws shows "Couldn't save securely. Nothing was stored." with "Retry with" the biometric. Retry prompts again and reuses the draft's `idemKey`, so a write that committed before it failed still leaves one row.
- On success the saved haptic plays, the flow closes and a 6 s toast offers Undo. Undo deletes the row with no prompt.

**Deleting.** `DeleteSheet` reads the row masked, and its amount only while amounts are shown. A bank row shows "From your bank · read only" with no delete key, and `deleteRow` refuses it before any prompt. A missing row says "This transaction isn't here any more." A cancelled prompt keeps the sheet silently. A failed match says "Nothing was deleted." and offers another try. A delete closes back to History with a 6 s Undo, which restores the same row with no prompt.

**Double submit.**
- **Draft key.** The draft gets an `idemKey` from `randomUUID()` when the flow opens, stored in a `UNIQUE` column, so a repeat save returns the existing row.
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
| Accents | Two SVG layers inside `mv` (`components/sen-accents.tsx`) | The swoosh draws behind the coin, before `rl`. Stars and ticks draw after `rl`. Neither follows the spin. They stay mounted on full-tier rigs, driven by one accent clock `fx` that rests at the end (all clear), so popping them commits nothing. A mark with `accents` restarts `fx` from the clock's callback. The timeline is MAX-Library `.L-fx` from its 160 ms lead (`art/accents.ts`) |

**Accents.**
- `accentShapes(tone)` in `art/geometry.ts` holds the board geometry. The swoosh is `M-330 60 Q-330 250 -140 300`, stroke 44 with round caps. Stars are filled and stroked 10 wide with round joins. Three ticks are stroked 18 wide.
- The boards draw the swoosh on with `pathLength="100"`. react-native-svg supports `pathLength` only on web (inferred from its source), so the swoosh dashes by its real length, `SWOOSH_LENGTH` (334.2 units). A board dash offset `d` becomes `d × 334.2 / 100`.
- Colours follow the surface Sen sits on: `SEN_ACCENT_TONES` in `src/theme/colors.ts`. On a pastel, ink marks and a paper swoosh at 75%. On the ink hero, lemon marks and a lemon swoosh at 22%. On the cream canvas, deep green marks and a green swoosh at 16%.

- **One public `<Sen>`.**
  - Without an `id` it renders `SenStatic` (`features/sen/components/sen-static.tsx`), a memoised pure render of a pose with no Reanimated hooks. That covers headers, toasts and the app-switcher cover. Under 48 pt it draws face and eyes only. It walks `treeFor(senTier(size))`, calls each node's `read(poseFrame(pose, prop), unit)` and skips nodes at opacity 0. Clip ids come from `useId()`. It never draws accents or the edge pill, because a pose never spins.
  - With an `id` it renders `SenRig` (`components/sen-rig.tsx`). It holds one `makeMutable` per channel (`components/rig-values.ts`), mounts every node of its tier, and gives each node's mapper only that node's channels, so a still part does no work. It rests in its `pose`: a pose change eases every channel there, opacities in 120 ms and the rest on `SPRING.settle` (150 ms timings in Calm, a snap in Off). `sen-rig.test.tsx` renders a rig in every pose, and after easing from one pose to another, and checks each node draws what `SenStatic` draws.
- **Shared node code.** Both render from the same node functions (`art/nodes.ts`), so the static and animated drawings can't drift.
  - `NODES` gives each part its declared channels and a worklet `read(frame, unit)`. A test calls each `read` through a recording Proxy and checks it reads exactly its channels, because a mapper wakes for every shared value it captures.
  - `SVG_TREE` holds the coin's nesting and draw order as data, in the boards' order: rim and face, cheeks, the clipped `lk` (eyes, mouths, shades), the cap, then the paws. `treeFor(tier)` drops cheeks, mouths, paws and held props at the face tier.
  - Geometry in `art/geometry.ts` is copied from kit.py, and the Bunga back (DESIGN › Owner overrides), edge pill and accents from MAX-Library and MAX-Moments.
- **Never in a row.** Sen never goes inside a FlashList row.
- **Viewbox.** The Svg uses a 680-unit box so raised paws and tilts aren't clipped.

### Moments as data

```ts
type Step = { at: number; v: number; ease?: Ease } | { at: number; v: number; spring: SpringName };
type Steps = readonly [Step, ...Step[]];                       // never empty
type Moment = { id: MomentId; priority: 0 | 1 | 2 | 3; from: PoseId; to: PoseId; dur: number;
                tracks: Partial<Record<Channel, Steps>>;     // one track per channel
                calm?: readonly Channel[];                    // tracks Calm keeps, such as blinks
                marks: readonly { at: number; haptic?: HapticEvent; accents?: true }[];
                loop?: true; then?: MomentId };
```

- **Steps.** Each step is an arrival: the channel reaches `v` at `at` ms along `ease` from the step before. A track that opens with a step at 0 jumps there. One that doesn't moves from wherever the channel is. A spring step starts at `at` and ends its track.
- **From the boards.** A moment's tracks are a window of a board tile, `moments('.M-unlock', 0, 1370)` (`moments/build.ts`), read from `board.gen.ts`. The boards loop, so a tile can open on its loop's end state. `startFrom` holds an opening run at the app pose's value, and `settleInto` adds an ease into the end pose where the tile holds somewhere else. Each moment says which it uses.
- **Compiler.** `compileTrack(steps, dur, loop)` (`timeline/compile.ts`) turns a track into `withSequence` of `withTiming` and `withSpring`, all `ReduceMotion.Never`. A loop pads each lap to `dur` and repeats. When a moment cuts in on another, `entry` turns an opening jump into an 80 ms ease, and later steps keep their times.
- **Forms.** `formFor(moment, level, from, to)` is the moment at a motion level. Full is the data. Calm keeps the `calm` tracks and turns every other change between the poses into a 150 ms linear crossfade. Off snaps. Both keep the haptic marks and drop the accents.
- **Generated tracks.** `eulerSteps` builds the Euler wobble and its clack, and `edgeSpin` the spin's 240 ms intro and its 600 ms lap. Tests check both against the board tiles that draw them.
- **The moments.** `moments/` holds 22, one file per screen family: `amounts.ts` (Unlock, Reveal, Re-mask), `lock.ts` (Face ID scan, Auth failed, Lockout and its breathing), `history.ts` (Network error and Retry, the refresh spin, its loop and landing, Empty search), `feedback.ts` (Copy, Saved, the two theme changes) and `ambient.ts` (the P0 beats). `moments.test.ts` checks every moment opens on what its start pose draws (or, for a follow-up, on the frame the moment before it ends on), ends on what its end pose draws, and that every loop's lap closes on its first frame. `drawing.ts` composes the layers, so a squint held on the open layer and one held on the pose layer draw the same. Empty search alone opens off-pose, hidden behind the slip.
- **Constant tracks.** A board value that never changes in the window stays as one step at 0, because it can differ from the start pose (Auth failed's eyes are 0.9 wide throughout).
- **Marks.** A per-rig clock shared value runs one `withTiming` per mark and one to the end. Their callbacks fire haptics through `scheduleOnRN`, so they stay on the UI thread's frame.
- **Android props.** `package.json` turns on Reanimated's `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` static flag, so animated transforms and opacities apply on the frame they change instead of waiting for a commit (inferred from the flag's name, not measured). It is a native build setting: it takes effect on the next Gradle build, and the smoothness gate on a looped Unlock follows (PLAN › Lane 4d).
- **UI thread.** The rig starts a moment's tracks and its clock in one `scheduleOnUI` job, and settles and snaps the same way. Those steps read the current values, and a JS read of a value the UI thread changed blocks on a round trip (`USE_SYNCHRONIZABLE_FOR_MUTABLES`, on by default in 4.5.1). An unmounted rig cancels every channel, so no loop outlives it.
- **Easing.** Every easing uses the canvas curves as `Easing.bezier`: out `.2,.8,.2,1`, sine `.37,0,.63,1`, inQ `.55,.085,.68,.53`, outQ `.25,.46,.45,.94`, inS `.12,0,.39,0` and outS `.61,1,.88,1`. The board and the app then draw the same curve. A board curve with no token stays a bezier tuple in the data.
- **Launch curves.** MAL-Timelines adds `malSpring` `.34,1.56,.64,1` (one overshoot, `SPRING.launch` damping 12 and stiffness 180 as a spring), `handoff` `.3,1.25,.5,1`, and the hop curves `hopOut` `.2,.7,.4,1` and `hopIn` `.6,0,.8,.3`. `src/motion/tokens.ts` holds each as `BEZIER`, `EASE` (for `withTiming`), `EASE_FN` (a plain worklet function, for `kf`) and `EASE_CSS`.
- **No CSS animation in the rig.** Reanimated CSS animations can't drive SVG group transforms, ignore reduced motion, and can't be seen in Jest. Ambient beats use the same compiler.

### MotionDirector

A pure reducer, `direct(state, event, info)` in `director/reducer.ts`, behind a small module store (`director/store.ts`). It never touches shared values. It emits commands, and the store runs them through each rig's handle.

```ts
type DirectorEvent = { type: 'register' | 'unregister' | 'stop'; sen } | { type: 'request'; sen; moment: MomentId }
                   | { type: 'finished'; token } | { type: 'gate'; patch: Partial<{ scroll; focused; appActive }> };
type Command = { type: 'play'; sen; moment; token } | { type: 'settle'; sen };   // settle: stop and ease into its pose
```

- **One slot.** `playing` holds one Sen, so only one Sen ever plays a moment. `queued` holds at most one more.
- **Priority.** A higher priority replaces what plays, and the replaced Sen settles. So does any request from the Sen that plays, and any request of the same priority that meets a loop. Another Sen at the same priority takes the queue slot, and a newer one bumps it. P0 is dropped, never queued. A lower request from another Sen settles that Sen, so a pose change still lands without its moment. A lower request from the playing Sen is dropped: its moment plays on and ends by resting the Sen in its current pose.
- **Follow-ups.** A finished moment with `then` plays that moment next on the same Sen (Lockout into its breathing).
- **Stop.** `stop` settles the Sen if it plays and promotes the queue, or empties the queue slot if that Sen waits there. Loops end this way when their screen state moves on, such as the Face ID scan after a cancel.
- **Stale finishes.** A `finished` with an old token is ignored, which guards the race with a cancelled sequence.
- **Gates.** A closed gate settles whatever plays or waits. Scroll, unfocused and app inactive are the gates. `senScroll(true)` closes scroll, and `senScroll(false)` opens it 1.5 s later. History's list calls it from its drag and momentum events. A list that unmounts mid-fling never sends the end event, so History calls `releaseSenScroll()` when its list goes (a lock, or the full error), and so does the app gate on `background`. Pull-to-refresh is direct manipulation, so it never closes the scroll gate. `useSenAppGate()`, called by the root layout, closes `appActive` in the background only, because iOS reports `inactive` while the Face ID sheet is up and Lock's Sen scans under it. No screen sets `focused` yet: it is one gate for every Sen, so an unfocused History would also stop Detail's Sen.
- **Held loops.** A gate that closes on a loop, or on a moment whose `then` is a loop (Lockout into its breathing), keeps that loop in `held`, and it plays again when every gate opens. So the Face ID scan and the lockout's breathing come back after the background. A stop, an unregister or any other P1 to P3 request from that Sen while the gate is shut lets the loop go, because the screen has moved on.
- **Level.** The director doesn't know the motion level. Each rig compiles the form for its own level when it plays.
- **API.** `playMoment(senId, momentId)`, `stopMoment(senId)`, `senGate(patch)`, `senScroll(scrolling)` and `releaseSenScroll()` from `@/features/sen`. A Sen's `id` is the name other features use.
- **Pose changes.** A rig whose `pose` changes asks for `TRANSITIONS['<from>><to>']` (`moments/index.ts`) when there is one, and eases into the pose otherwise. After a moment it snaps to the moment's end pose, which draws the same, then eases to its `pose` prop if that differs.
- **Ambient.** A rig resting in a pose with an `AMBIENT` entry schedules its own P0 beats with a JS timer, `nextBeat(ambient, played, random)`. Idle blinks 70%, glances 20% and double-blinks 10%, every 4 to 7 s, and rests 10 to 15 s after 3 beats. Revealed, the month card Sen of MAX-Moments' Idle tile, does the same without the glance. A beat plays over the pose the Sen rests in, so a revealed blink keeps the grin and the raised face. Masked peeks every 6 to 9 s. Worried blinks slowly every 4 to 7 s. From 48 to 120 pt a Sen only blinks, and under 48 pt it stays still. Off schedules nothing.

### Motion levels

- **`useMotionPolicy()`.** Resolves `full`, `calm` or `off` from the "Sen's animations" setting and the system setting. System reduce turns Full into Calm.
- **Live system setting.** It reads `AccessibilityInfo.isReduceMotionEnabled()` plus its change listener. Reanimated's `useReducedMotion()` is read once at import and never updates (V). Lint bans it.
- **Calm.** It is compiled from the data (`formFor`). A moment keeps only its `calm` tracks, such as blinks, so hops, spins, flips and accents go, and its pose change becomes a 150 ms timing marked `ReduceMotion.Never`. Reanimated's own reduced motion would jump straight to the end (V).
- **Off.** Poses snap and haptics still fire.
- **`<MotionPolicyRoot>`.** Sets `ReducedMotionConfig` to `Never` in Full and `Always` otherwise. It is the live switch for every other worklet animation.
- **Plumbing.** `src/motion/` can't import services, so the root layout reads the setting through `useSenMotionPreference()` from `@/features/settings`, which follows the `senMotion` pref live, and passes it to `<MotionPolicyRoot preference>`. Without a root, as in a component test, `useMotionPolicy()` returns `'full'`.
- **CSS transitions.** They ignore reduced motion (V), so components set their duration to 0 from the policy.
- **Informational timers.** The lockout cool-down keeps counting in every mode, using `ReduceMotion.Never`.

### Animated components

Shared primitives are built once, so no agent re-implements a pattern.

| Component | How it moves | Thread and renders | Test |
| --- | --- | --- | --- |
| Amount reveal | `<RevealedAmounts>` (`features/transactions/reveal.tsx`) provides the `Revealed` value and one shared progress value. `RollAmount` draws coins while masked. Shown, the month hero gets one `Animated.View` per character with `digitStyle(p, col, cols)`: columns start in turn, `min(0.06, 0.5 / (cols − 1))` apart, rise 10 pt and land together. Card, row and net amounts roll in whole on one `Animated.View` (`digitStyle(p, 0, 1)`), because one view per digit in every row hung the UI thread when flinging a shown 10k list (spike R3). `FitWidth` scales the hero down to the card's width, so a long total never clips its sen. Full waits 200 ms, then rolls for 520 ms on `EASE.out`. Calm is a 150 ms linear fade with `ReduceMotion.Never`. Off is instant. Hiding sets progress to 0 with no animation, after the data is gone | UI. Mounted rows render once when the amounts arrive, then zero during the roll | `reveal.test.tsx`: hero column 0 at 0 before the delay, 0.95 and the last column at 0.52 100 ms into the roll, both at 1 at the end; a row amount is one view at 0.67 100 ms in; a `Profiler` counts zero commits during either roll; a hero wider than its box scales to fit |
| Press keys | `<Key>`: Gesture Handler `Pressable` (immune to the Android fast-path press bug, V). The face slides 4 px onto a static shadow plate with a 90 ms CSS transition, 0 ms outside Full. No shadow animates. Tones `lemon`, `loud`, `paper` and `outline` (no fill, no plate). Sizes `regular` (46), `medium` (52), `large` (56) and `xlarge` (60) come from the boards. `surface="hero"` draws a key on the ink hero with the dark palette in both themes. A disabled key washes its face out, or dashes an outline key. An icon-only key must carry a label | UI after one render | `pressIn` gives `translateY: 4`. A disabled key reads as disabled (`key.test.tsx`) |
| Segmented control | `<Segmented options value onChange>`. Equal segments in one lane, so the pill is `100/n %` wide and slides by percent `translateX` with a 200 ms CSS transition, 0 ms outside Full. Nothing to measure. Segments are radios. The caller fires the haptic | UI | Press "In" gives `translateX: '100%'` (`segmented.test.tsx`) |
| New row slide-in | `<EnterOnce>` runs the board's `slidein` keyframe once on mount, 900 ms, in Full only (`enterStyle(level)`). The `arrivals` store in `features/transactions/data.ts` holds two things. `after` is the newest row from before a pull or Retry, and rows past it are new (`isArrival`). `added` is the row the Add flow just saved, which can be back-dated. The Add flow calls `markArrival(id)` from `@/features/transactions` before its refetch. The row lands while Add covers History, so `HistoryScreen` hands the list `added` only while it is focused, then clears it 900 ms later. History passes the store to FlashList as `extraData`, and `renderItem` wraps only arrival rows. `after` clears 900 ms after the refetch lands, so recycled cells never replay it. FlashList's keep-scroll-position stays at its default (on). Spike R2 on the phone: at the top the row slides in under Today with no jump. Scrolled into Today's rows, on and off both push the visible rows down one row, because the insert lands right under the Today day top (the anchor, inferred) | UI | Pure `enterStyle` test. `history-list.test.tsx`: the wrapper holds the new row only, and none after the arrival clears |
| Toasts, offline banner | One `<ToastHost>` at the root with module-level `FadeInDown` and `FadeOutDown`, keyed by id. Features call `toast.show({ title, detail?, action?, ttl?, mark? })`, which returns an id, and `toast.hide(id?)`. One toast at a time: a new one replaces the current one and its timer. The default is 6000 ms. A bar drains over the toast's life at every motion level, because it shows time left rather than decorating. `mark` takes a face-only `<Sen>` | UI | Undo runs once and dismisses. Gone at 6000 ms, not 5999. A replaced toast's timer can't hide the new one (`toast.test.tsx`) |
| Add key | `<AddKey>` (`features/transactions/add-key.tsx`): a loud `xlarge` icon-only `<Key>` in an absolute dock, 20 from the right and 16 above the bottom inset. `useToastShowing()` from `components/toast.tsx` lifts it `TOAST_RISE + 16 − 16` = 92 pt with a CSS transition on the toast's own `TOAST_ENTER_MS` (300) in and `TOAST_EXIT_MS` (250) out, `EASE.out`, 0 ms outside Full. It unmounts while `Keyboard` reports the search keyboard up, and `HistoryView` leaves it out on the full error. It sits right after `<Header>` in the tree, so TalkBack reads it second, and `zIndex` keeps it over the list. The list footer pads `ADD_KEY_CLEARANCE` (104) above the inset | UI | `add-key.test.tsx`: the label and press, 0 then −92 with a toast, gone while the keyboard is up |
| Pull-to-refresh | Phase 2 (lane 4e): `PullToRefresh` (`features/transactions/pull/`). A `Gesture.Pan` (`activeOffsetY 8`, `failOffsetY −8`) runs beside the list through RNGH's `ScrollView`, set as FlashList's `renderScrollComponent` with `simultaneousHandlers` on the pan. The list reports its offset into a shared value, and the pan only pulls while the offset is 0, so a drag that scrolls up to the top carries on into the pull. `gapFor` turns finger travel into a gap height (0.6 resistance, easing to 132 pt), the gap opens above the list and the list translates down with it. Past 72 pt it ticks (`refreshThreshold`) and reads RELEASE TO REFRESH. Letting go there holds the gap at 96 pt and asks `HistoryScreen`, which reports `pull` as `loading`, then `landed`. Sen in the gap is a still drawing while pulled, stretched 0.9 by 1.18 and rising out of the gap. While loading it is the rig `pull` playing `refreshSpin` and its loop. On `landed` it plays `refreshLand` (its haptic is the pull's landing haptic), and 1281 ms later the screen sets `pull` back to `idle` and the gap closes. If the pan fights the list on the phone (spike R1), the fallback is FlashList `refreshing`, the platform `RefreshControl`, with Sen in an overlay slot. A landed pull shows the "Updated just now · N new" pill for 2.5 s and fires `refreshLanded`. A failed one fires `networkError` and keeps the list under the banner. | UI | `pull-refresh.test.tsx` and `history-screen.test.tsx`: a pan released past 72 pt runs the sync, an offline pull keeps the list under the banner, and Retry lands one new row |
| Skeleton | `<Bone width height radius?>` with one CSS keyframe band, 1.4 s linear, in Full only. Calm and Off draw still bones | UI, no renders | Pure `bandStyle(level)` test (`bone.test.tsx`) |
| Launch | `<SenLaunch target rest ready onDone>` from `@/features/sen` (`components/sen-launch.tsx`, data in `moments/launch.ts`), MAL2 (`design/MAL2-Loading.dc.html`, `design/MAL-Timelines.dc.html`). `LaunchCover` in `SessionRoot` (`features/auth/screens/launch-cover.tsx`) mounts it over the first screen, which renders underneath from frame 0, and passes `target`: that screen's Sen box and hero height in window points. `rest` is the pose that Sen rests in: Lock's `masked`, so the eyes shut inside the handoff, or Welcome's `idle`, which then eases into `happy` to wave hello. One clock `t` drives every part through `kf` over the MAL2 tracks in `board.gen.ts`: travel, scale and the rig's squash, wink, mouth and cheeks (set each frame by one `useAnimatedReaction`), the letters, wordmark, panel height and radius, sparkles, ticks and swoosh. Board px scale by Lock's face radius over the board's 101. The story runs to 2394 ms with the haptic from the 1512 ms segment's callback. Not ready, Sen hops on the period every 600 ms. Ready, the hop finishes and the handoff runs to 3276 ms: Sen grows into Lock's Sen at the same box while the panel shrinks into Lock's hero, Lock's UI fades in under a canvas veil, then `onDone` unmounts it. Calm and Off show the settled period (2394 ms), hold 400 ms and fade out in 200 ms, with no haptic. Reduce motion resolves after the launch starts, so a switch to Calm mid-story jumps to that frame | UI, zero renders | `sen-launch.test.tsx`: fake timers at frame 0, the S at 378, the landing at 1512, the wink at 1743, the wait hop, the handoff at 3108, Calm, Calm turning on at 300 ms, and a `Profiler` with zero commits |
| Theme switch | Unistyles, instant, no re-render | Native | Device render counter |
| Privacy cover | iOS: a plain conditional cover on `inactive` (skipped while a biometric prompt runs, via `isAuthenticating`) and `background`, re-checked when a prompt ends because a prompt cancelled by swiping to the switcher leaves the app `inactive` with no new event (`onAuthenticationEnd`) and re-synced right after subscribing so a change during cold start is not lost, no enter animation, mounted last in the root layout and again inside the delete sheet and the add layout, which native presentation draws above the root view. Android: none, FLAG_SECURE blanks recents, and Android never emits `inactive` (V) | | `privacy-cover.test.tsx`. Android: recents screenshot |
| Sheets, modal, pushes | Native stack. Fade in Calm and Off | Native | Device only |

Files: `src/motion/` holds `tokens.ts` (easing, springs, durations, `cubicBezier` CSS ports), `policy.tsx`, `countdown.ts` (`useSecondsLeft`, for the lockout cool-down), `threshold.ts` (`useThreshold`) and `timeline.ts` (`kf(t, stops, values, eases?)`, where `eases[i]` shapes the segment from `stops[i]` the way a CSS keyframe's timing function does, so hop arcs have no corners; and `useLoopClock`, a read-only clock derived from one linear run so laps never lose a frame). The components (`key`, `segmented`, `enter-once`, `skeleton`, `toast`, `countdown`) live in `src/components/`. Sen lives in `src/features/sen/` (`art/`, `channels.ts`, `poses.ts`, `timeline/`, `moments/`, `director/`, `components/`).

**Reading the level.** Components read the level only through `useMotionPolicy()`, or `useEffectiveMotionLevel()` where `FrozenMotion` must still win (it reads `off` under the gallery's freeze). `cssMs(level, ms)` in `src/components/motion-level.ts` zeroes every CSS transition outside Full, because CSS ignores reduced motion (V). Looping and decorative keyframes (`Bone`, `EnterOnce`) run in Full only.

**Colours.** Components read only theme tokens. Keys use `keyPlate` for the shadow plate, `keyEdge` for the paper key border, and `loud` with `onLoud` for the screen's one loud fill. `Bone` draws its band in `shimmer`, and the slip's dotted `Leader` uses `leader`. Key colours and every `MaterialCommunityIcons` `color` come from `useUnistyles()` in render, because on the device a live theme switch left text inside an animated view and icon colours on the old theme.

**States gallery.** `sen://dev/states` (dev builds only) draws any screen state from fixtures, with no services and no database.
- `?screen=<screen>&state=<state>` draws one state. `?screen=sen&pose=<pose>&size=<pt>` draws one Sen, and `?screen=sen` alone shows every pose at 32, 72 and 200 pt. No `screen` lists every link. `screen=db` runs the database smoke.
- `&theme=dark` or `&theme=light` forces a theme with `UnistylesRuntime.setAdaptiveThemes(false)` and `setTheme`, Unistyles' documented runtime switch, while the screen has focus. Leaving applies the saved Theme again. `ScopedTheme` was not used, because its Jest mock renders nothing.
- Each drawn state mounts fresh, keyed by its query, and carries a test id `shot-<name>` so a flow can wait for the right screen.
- Component states draw in a captioned frame. Every other screen draws edge to edge, as it does in the app (`isComponent` in `registry.ts`). Welcome and Lock set light status-bar icons over their ink hero, and the live Welcome can sit under the gallery, so the frame sets its icons from the forced theme.
- `motion` plays each Sen moment once on a 240 pt rig (`SEN_STATES` in `src/features/sen/states.tsx`): it holds the start pose 600 ms, then changes pose the way a screen would (Reveal on `masked` to `revealed`) or requests the moment. `launch` draws Lock's hero with its masked Sen and runs `SenLaunch` over it. `.maestro/subflows/moment.yaml` (`-e MOMENT=<state> -e THEME=light`) records one and screenshots where it settles, and `.maestro/sen-moments.yaml` runs them all. `flows.test.ts` fails when that list and `SEN_STATES` disagree.
- `auth` draws Welcome, the primer (`primer-ready`, `primer-off`) and every Lock state (`lock-idle`, `lock-checking`, `lock-mismatch`, `lock-lockout`, `lock-off`, `lock-unavailable`, `lock-error`) from `AUTH_STATES` in `src/features/auth/fixtures.tsx`, with Face ID as the boards draw it.
- **Registering a screen.** Export the screen's states from its own feature index as a plain object of render functions, such as `export const HISTORY_STATES = { masked: () => <HistoryView rows={FIXTURE_ROWS} /> }`, with the fixtures in that feature folder. Then add one entry to `SCREENS` in `src/features/gallery/registry.ts`, such as `history: HISTORY_STATES`. Type the object with `satisfies Record<string, () => ReactNode>` rather than importing the gallery's type, so the import runs one way.
- **Frozen loops.** `GalleryBody` wraps every state except `screen=motion` in `FrozenMotion` (`src/motion/policy.tsx`). Under it `useEffectiveMotionLevel()` reads `off`, so `Bone` draws no band and `SenRig` plays every moment, ambient beats and Reveal alike, in its Off form (a snap), and `useSecondsLeft` stops ticking, so the lockout card holds `0:24`. The motion level itself is unchanged, and nothing outside the gallery mounts it. Maestro waits for the screen to stop changing, so a looping animation cost up to about 30 s per link.
- `.maestro/gallery/` is generated from the registry: `<screen>-light.yaml` and `<screen>-dark.yaml` for every screen, and `pose-<pose>.yaml` with the pose at every tier. Each step opens one state's link, waits for its `shot-<name>` id and for the screen to settle, then saves `<name>.png`. `src/features/gallery/flow.test.ts` fails when the folder and the registry disagree. `UPDATE_FLOW=1 npx jest src/features/gallery/flow` rewrites the folder. `npm run device:shots -- '<glob>'` runs the flows whose names match, and the shots are candidates in `shots/runs/<timestamp>/png/`. The owner promotes approved ones to `assertScreenshot` baselines.

### Proving motion works

This follows what Reanimated's docs and large open-source apps actually do. A survey covered 15 projects, among them Expensify, Bluesky, Rainbow, Mattermost, React Navigation, FlashList and Reanimated itself.
- **Jest.** It checks values at chosen times.
- **Pure functions.** Motion maths lives in plain functions tested with literal numbers.
- **Maestro.** Flows and screenshots cover settled screens.
- **By eye.** Motion quality and smoothness are judged on a release build on a real phone.

No surveyed app pixel-tests frames mid-animation or gates animation FPS in CI, so Sen doesn't either.

**Board to milliseconds.** `python3 -I scripts/board-keyframes.py design/MAX-Moments.dc.html` prints every CSS animation on a board as a timeline: the selector, the keyframes' duration and delay, then each stop in ms with the easing that runs from it and its values. Easings with a token print by the token's name (`out`, `hopIn`).
- **The data.** With `--ts` the same script writes `src/features/sen/board.gen.ts`: every track on MAX-Library, MAX-Moments and MAL2 as arrival steps `[ms, value, easing]`, keyed by board, moment selector and channel. Moments slice their window out of it with `boardTracks(moment, { from, to })`, so a moment is the board's own numbers. `board.test.ts` reruns the script and fails when the file and the boards disagree.
- **Spin.** The boards fake the edge spin with scaleX keyframes eased `inS` toward edge-on and `outS` away. That is cos of a steady angle, so the script turns scaleX into the angle `sp.th` (forward on a tie, backward when the coin turns back without showing tails) and runs those quarters linear.
- **Skipped.** Heads, tails and the edge pill are drawn from `sp.th`, so their board opacities are not tracks. Screen furniture on the MAX boards (the list, digits, buttons, toasts) belongs to other features. `.M-launch` is superseded by MAL2.

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
- **Workers.** `jest.config.js` sets `maxWorkers: '50%'`, one worker per physical core on a hyperthreaded host. Jest's default of one worker per logical CPU less one gave no faster runs here, and the slowest tests ran at up to 4 s against the 5 s timeout. They are slow because the worklets mock fires `requestAnimationFrame` through `setTimeout(0)`, so fake time runs one frame per millisecond, and the motion tests' literal values depend on that schedule. The worker count only decides how many test files run at once, so it changes no test's result.
- **Timers.** Use `jest.useFakeTimers()` with `jest.advanceTimersByTime` or `jest.runAllTimers()`. The older timer helpers are deprecated.
- **Async APIs.** RNTL 14's `render` and `act` are async.
- **Unistyles.** `jest.setup.ts` imports `react-native-unistyles/mocks` and then calls `configureThemes('system')`, so no test file touches MMKV before it can mock it. `features/settings/theme.test.tsx` loads the real boot module. The mock's `setTheme` does nothing, so that test stands in a runtime that follows Unistyles' native rules.
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
| T3 | App switcher snapshot | iOS: the privacy cover on `inactive` (not while the Face ID sheet is up) and on `background`, over the secure canvas from T4. The delete sheet and the add flow carry their own cover. Android: FLAG_SECURE blanks recents, so no JS cover | `features/security/privacy-cover.tsx` | Open recents |
| T4 | Screenshots and recording | `preventScreenCaptureAsync` for the whole app in release builds: FLAG_SECURE (Android), secure canvas (iOS 13+). Retried on foreground after a native failure. An Activity recreation re-engages it through unmount and remount. Off in dev builds so agents can screenshot | `features/security/screen-guard.ts` | Screenshot in the release APK: blocked |
| T5 | Malicious or malformed input | Custom keypad, integer sen, zod limits, sanitiser | `features/add/`, `models/draft.ts`, `services/sanitize.ts` | Paste RTL marks: stripped |
| T6 | Tampered or corrupt data | zod on every read, drop and count, reset on an unreadable database | `services/tx-repo.ts` | Reviewer control "Bad data" |
| T7 | Leaks via logs, crash reports, clipboard, accessibility, devtools | No amount from the database in JS while masked. The mock bank's feed, which stands in for a server, does hold amounts in JS. Logger takes event codes only, `console` banned by lint. Clipboard gets the reference only, marked sensitive (D29). Cache cleared on lock. Error UI never shows messages | `features/transactions/`, `services/logger.ts` | Screen reader says "Amount hidden" |
| T8 | Deep links that skip the lock | Protected routes are not mounted while locked. A link that brings the app back past `relockAfter` locks it before the link is weighed | `app/_layout.tsx`, `features/auth/held-link.ts`, `features/auth/locks.ts` | `adb shell am start -d sen://transaction/x`: Lock, then that receipt after unlock |
| T9 | Double submit | Idempotency key, disabled key | `features/add/`, `services/tx-repo.ts` | Tap Save twice fast: one row |
| T10 | Backup extraction | `allowBackup: false`, rules that exclude every domain from cloud backup and device transfer, `THIS_DEVICE_ONLY` key | `app.config.ts`, `plugins/with-no-backup.js`, `services/vault.ts` | Inspect `AndroidManifest.xml` |
| T11 | Bad data from the "API" | `TransactionSchema` parse at sync | `services/sync.ts` | Reviewer control "Bad data" |
| T12 | The dev auth override skipping biometrics | Only `sen://dev/states` sets it, and that route is mounted only under `__DEV__`. `setAuthOverride` stores and `authenticate` reads only under `__DEV__`, which a release bundle compiles to `false`: the setter becomes an empty function and the prompt function is a bare `authenticateAsync` call. Memory only | `features/auth/prompt.ts`, `features/gallery/index.tsx` | `prompt.test.ts` (a release build stores and reads no override). `npm run release:auth-check` greps a production bundle |
| T13 | The reviewer controls in a release build | They only shape the fake bank's answers, which zod still parses, and the lockout control only adds a failure before the real prompt. Nothing in them passes a check, shows an amount or skips step-up. Separate from the T12 override | `features/settings/`, `features/transactions/data.ts`, `features/auth/session.ts` | `settings/reviewer-faults.test.tsx`, `auth/session.test.tsx` (an armed lockout never prompts, and a disarmed one prompts for real). `npm run release:auth-check` |

**What this does not protect against.** The README says this in plain words.

| Item | Why |
| --- | --- |
| A rooted or instrumented device | The step-up result is a JS boolean. A hooked runtime can skip it. A production app would bind the key to biometrics or verify a signed challenge on a server |
| Amounts while shown | They sit in JS memory, the share sheet and the screen reader tree, and they stay shown until the user hides them or the app locks. Every unlock and cold start lands masked. Masking protects the hidden state |
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
| Copy hands the reference, and only the reference, to the sensitive clipboard. A missing module or a native error reports a failed copy | `services/clipboard.test.ts`, `features/detail/detail-screen.test.tsx` |
| Share receipt is offered only while shown and sends the board's plain text | `features/detail/detail-screen.test.tsx`, `features/detail/receipt.test.ts` |
| Detail: every field shows while hidden, and no amount is in the tree or the cache. A bad, missing or deleted id shows not found. A read that throws shows Retry | `features/detail/detail-screen.test.tsx`, `features/detail/receipt.test.ts` |
| 10k rows mount fewer than 60 row components | `features/transactions/history-list.test.tsx` |
| Every state and event pair, `signingOut` included. `LOCK` during `authenticating` is ignored, and during `stepUp` it waits for the prompt to end | `features/auth/machine.test.ts` |
| Re-lock window (59 s stays, 61 s locks), idle lock. Home on a step-up prompt still locks. A long absence with the prompt still up locks when it ends, cancelled or not, and the next unlock is masked. A clock set back locks, away and idle | `features/auth/locks.test.ts` |
| Lock clears the cache, closes the database and hides the toast. An unlock during sign-out opens no prompt, and sign-out ends on Welcome. A lockout armed before sign out never reaches the next demo user | `features/auth/session.test.tsx` |
| A native auth error outside the typed union maps to `unknown` | `features/auth/prompt.test.ts` |
| Unlock opens History, and a lock unmounts it, which drops the draft with every protected route | `__tests__/lock-flow.test.tsx` |
| Step-up prompts every time with `'strong'`. A second call while prompting opens no second prompt | `features/auth/use-step-up.test.ts` |
| Showing prompts every time with `'strong'`. Cancel leaves amounts hidden. Hiding never prompts and drops the revealed queries. Every lock kind (manual, idle, background, sign-out) re-hides shown amounts, and the next unlock and a cold start land masked, with Settings' switch on and no Re-mask | `features/auth/amounts.test.ts` |
| Locked deep link renders Lock | `__tests__/guard.test.tsx` |
| A detail link opened while locked, or one that brings the app back past `relockAfter`, shows Lock, then that receipt over History after unlock. Inside `relockAfter` the receipt opens at once and nothing is held. Only a detail link is held, once, and never while unlocked, on Welcome or through a sign-out | `__tests__/lock-flow.test.tsx`, `features/auth/held-link.test.ts` |
| Sync twice and interrupted give the same table hash. A page whose write fails keeps none of its rows. Bad rows are dropped and counted. A bank row never overwrites an added row. A reset while a page is in flight keeps that page out | `services/sync.test.ts` |
| Search "entral" matches a JS filter on 10k rows. Masked reads hold no amounts, totals included. `%` and `_` match only themselves. Add is idempotent. Delete refuses bank rows. Undo restores the same row | `services/tx-repo.test.ts` |
| Seed is deterministic, valid, never in the future. Its newest rows are the boards' | `services/seed.test.ts` |
| Bank paging, faults, slow mode, a timeout that answers after 8 s, one new row per refresh | `services/bank-api.test.ts` |
| A reviewer fault covers one history request, its retry included, then reads Normal. A fault picked mid-request leaves that request whole and fires on the next one. An unlock of a finished history sends no request, so it never uses up an armed fault. A bank reset runs the first sync again, and one in the middle of a slow sync leaves exactly the new dataset | `features/transactions/history-screen.test.tsx` |
| Missing key resets the database, by the reset table. A busy disk wipes nothing. A key without its database file counts as no vault and is deleted, and a file check that throws keeps the key. Key shape and storage options | `services/vault.test.ts` |
| Prefs read back, fall back to defaults, and notify on write and clear | `services/prefs.test.ts` |
| Each reviewer fault from Settings shows its designed state on History, says it is simulated, reads Normal again after one request, and Retry or the next pull recovers. A fault picked during a two-page load leaves that load whole and fires on the next pull. Slow mode holds a pull 3 s and turning it off lands the next at once. A dataset switch shows its progress, and Offline before it fails the first load full screen | `features/settings/reviewer-faults.test.tsx` |
| Settings writes every control's pref. Turning off Hide amounts asks for biometrics and a cancel keeps them hidden. The lockout control arms, offers Undo and disarms. Reset demo data restores the reviewer defaults and keeps security choices. A failed reset or dataset switch changes no pref and says so. Opened at the reviewer controls, the screen scrolls there once | `features/settings/settings-screen.test.tsx`, `features/settings/sheets.test.tsx` |
| Choosing Dark switches the live theme at once and saves it. System follows the phone, light or dark. Sign out returns to System. A saved choice is in the theme settings before the first screen loads | `features/settings/theme.test.tsx` |
| The logger takes an event code and nothing else | `services/logger.test.ts` |
| Haptics per platform, silent when the setting is off | `services/haptics.test.ts` |
| Log schema rejects amounts. An amount forced into an event never reaches the table. The log keeps the newest 50, orders events within one millisecond, holds events while locked and clears to one entry | `models/activity.test.ts`, `services/activity-log.test.ts` |
| An unlock, a wrong finger, a lock, a reveal and a hide are logged. A failed unlock is held until the vault opens. A cancel logs nothing. Sign-out drops held events | `features/auth/activity.test.tsx` |
| Add, delete and both undos log the description and no amount. A repeated save logs once. A refused action logs nothing | `features/add/actions.test.ts` |
| The screen reads the log as day slips, clears it behind the check, and recovers from an unreadable log | `features/activity/activity-screen.test.tsx`, `features/activity/days.test.ts` |
| Erase deletes only the added rows, logs the count and refreshes History, and leaves bank rows, the key, the file and the prefs. A mismatch or cancel erases nothing. A failing delete changes nothing and Try again finishes. With nothing added the row is off. A check that is off offers the device settings | `__tests__/erase-flow.test.tsx`, `features/settings/settings-screen.test.tsx` |
| A label longer than the description limit is cut and the event kept. Held events are written in one transaction | `services/activity-log.test.ts`, `models/activity.test.ts` |
| Input limits, keypad cap, sanitiser | `models/draft.test.ts`, `features/add/keypad-reducer.test.ts`, `features/add/draft.test.ts`, `services/sanitize.test.ts` |
| A double tap on Save prompts once and stores one row. Cancel writes nothing. A write that committed but failed stores no second row on Retry. Undo of an add or a delete never prompts. Delete refuses bank rows before the prompt. The description field has the private input props and shows the cleaned text | `features/add/actions.test.ts`, `features/add/add-flow.test.tsx`, `features/add/delete-sheet.test.tsx` |
| Money: sign, split numerals, spoken amounts | `models/money.test.ts` |
| Integer sen at the storage layer. A repeated idempotency key is refused. `day` matches `malaysiaDay` | `services/db/schema.test.ts` |
| A masked query that selects an amount fails its parse | `services/db/rows.test.ts` |
| A root call never lands inside an open transaction. A failed savepoint undoes only its writes | `services/db/port.test.ts` |
| The key is the first statement on the device database | `services/db/expo.test.ts` |
| Release config always guards screens, dev never does, and a foreground event retries the guard only after a native failure (the real expo-screen-capture JS runs, only the native module is mocked) | `features/security/screen-guard.test.tsx`. `npm run release:guard-check` greps a production bundle for `guardsScreens` returning true and the guarded call. Both release checks run from the main checkout only, and fail loudly if the bundle lacks the app's code (a worktree with a symlinked `node_modules` exports none) |
| The privacy cover per platform and app state, and not over the Face ID sheet | `features/security/privacy-cover.test.tsx` |
| Backup rules exclude every domain and the manifest points at them | `plugins/with-no-backup.test.ts` |
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

## Timing marks and release build

- **Unlock marks.** `src/services/perf.ts` `mark()` logs `[sen] perf <mark> +<ms>` (through `logTiming` in `logger.ts`) for `unlock.ok`, `vault.opened`, `arriving`, `arrived`, `history.mounted`, `history.rows` and `history.painted` (FlashList `onLoad`), each once per unlock and relative to `unlock.ok`. A mark before `unlock.ok` logs nothing, so the gallery and a cold launch stay quiet. Locking, or a failed vault open, calls `endUnlock()`, so a gallery History drawn later in the same dev session logs nothing either. It returns at once unless `__DEV__`, so a release bundle logs nothing. Read the lines from logcat (`adb logcat -s ReactNativeJS`).
- **Month card Sen.** The first frame draws the still Sen and the rig takes over two frames later (`MonthSen` in `parts.tsx`). The rig makes a shared value per channel and an animated mapper per part. A Jest test pins that the rig draws what the still Sen draws at rest, so the swap shows no change. If the month flips between hidden and shown inside that window, `MonthSen` plays the Reveal or Re-mask once the rig mounts, because the rig itself starts in the new pose and would skip it.
- **Release build.** `expo-build-properties` in `app.config.ts` turns on R8 minify and resource shrinking for the release variant only. Hermes is on (`hermesEnabled=true`, bytecode compiled by `hermesc` in release). The local `android/` folder is generated and git-ignored, so the plugin applies at the next `npx expo prebuild`, and EAS applies it on its own.
