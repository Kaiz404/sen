# Sen architecture

How Sen is built. The security model and threat model below stand. Storage, list, styling, state and tooling are under review in [DECISIONS.md](DECISIONS.md) for the 10,000-transaction, local-first target. Where an owner pick there differs, the pick wins and this file gets updated. No code exists yet, so every path below is the plan. Claims marked **V** were verified against a primary source on 2026-10-14 or 2026-10-15. Claims marked **I** are inferred.

Sen is a frontend-only app. The "bank" is an in-app mock service. The brief is titled "Secure Transaction History Module", so security is the organising idea. Every layer has a security job.

## Stack

Expo SDK 57 (`expo@57.0.28`), React Native 0.86.3, React 19, TypeScript ~6.0.3 with `strict: true`. Scaffold with `npx create-expo-app --template default@sdk-57`. Install every Expo package with `npx expo install` so versions match the SDK. Bundled versions come from https://unpkg.com/expo@57.0.28/bundledNativeModules.json (V).

| Need | Package | Version | Notes |
| --- | --- | --- | --- |
| Navigation | `expo-router` | ~57.0.26 | `Stack.Protected` guards (SDK 53+, V). `redirectTo` is SDK 58 only, so `lock` is the anchor of the unprotected group |
| Styling | `uniwind` + Tailwind v4 | 1.12.2 | Not NativeWind. `withUniwindConfig` is the outermost Metro wrapper. Import `global.css` in the root layout |
| Biometrics | `expo-local-authentication` | ~57.0.3 | `biometricsSecurityLevel: 'strong'` (Android only, default `'weak'`, V) |
| Server state | `@tanstack/react-query` | 5.104.x | Wire `focusManager` to AppState and `onlineManager` to `expo-network` by hand |
| Validation | `zod` | 4.6.x | Parse at every boundary. v4 issues carry no input by default (V) |
| Preferences | `react-native-mmkv` + `react-native-nitro-modules` | 4.3.x / ≥ 0.35 | Not bundled by SDK 57, so pin it. Needs a dev build |
| Vault key | `expo-secure-store` | ~57.0.4 | Keychain or Keystore |
| Secure random | `expo-crypto` | ~57.0.4 | `getRandomValues` and `randomUUID`. Never `getRandomBytes`, which uses `Math.random` in development (V) |
| Screen guard | `expo-screen-capture` | ~57.0.4 | Screenshot block on iOS 13+ and Android. Android FLAG_SECURE. iOS app switcher protection |
| Network | `expo-network` | SDK 57 | Offline banner, `onlineManager` |
| Animation | `react-native-reanimated` + `react-native-worklets` | 4.5.1 / 0.10.1 | The bundled versions. 4.7 is for SDK 58 |
| Gestures | `react-native-gesture-handler` | ~2.32.0 | Only if gestures are used directly. Then wrap the root in `GestureHandlerRootView` |
| Drawing | `react-native-svg` | SDK 57 | Sen |
| Haptics | `expo-haptics` | ~57.0.3 | `performAndroidHapticsAsync` on Android |
| Fonts | `expo-font` + Bricolage Grotesque + IBM Plex Mono | | Static width-75 and width-100 cuts for Android |
| Icons | `@expo/vector-icons` (MaterialCommunityIcons) | ^15 | |
| List | `SectionList` + `RefreshControl` | built in | Sticky date headers and pull-to-refresh built in. FlashList is not worth it at about 50 rows |
| Formatting | `Intl` on Hermes | | Add the +/− sign by hand (iOS lacks `signDisplay`). Money is integer sen |
| Tests | `jest-expo` + `@testing-library/react-native` | ~57.0.6 / 14.1.x | RNTL v14 APIs are async and need Node ≥ 22.13 |
| Lint | ESLint 9 flat + `eslint-config-expo` + Prettier 3 | | |

**Skipped on purpose.**

| Option | Why |
| --- | --- |
| zustand, Redux, Jotai, XState, Legend | Session state is one typed reducer. Server state is TanStack Query |
| FlashList, Legend List | Their gains show at thousands of rows |
| `react-native-biometrics` | Unmaintained |
| `react-native-keychain` | Its value is biometric-bound keys, which need a backend to mean anything |
| Sentry, Storybook, i18n | No account to show, costly to set up, one locale |
| Maestro, E2E | Out of scope. Unit and component tests only |
| Expo Go | Can't run MMKV. Face ID doesn't work in it on iOS. SDK 57 leaves the store app when SDK 58 ships |

## Layers

```
 ┌──────────────── app/ (routes, thin) ────────────────────────┐
 │ _layout.tsx: Stack.Protected guard={unlocked}               │
 │ lock  (index)  transaction/[id]  add/  settings/  security/ │
 └───────────────▲─────────────────────────────────────────────┘
                 │ view models only. amount is null while masked
 ┌───────────────┴──────── features/ ──────────────────────────┐
 │ auth/         state machine, session, step-up, idle, cover  │
 │ transactions/ queries, selectors (MASK HERE), list, detail  │
 │ add/          draft reducer (memory only), keypad, review   │
 │ activity/     activity log screen                           │
 │ settings/     preferences, reviewer controls                │
 │ security/     screen guard, erase                           │
 │ sen/          mascot rig, poses, MotionDirector             │
 └───────▲──────────────────────▲──────────────────────────────┘
         │ typed domain objects │
 ┌───────┴──────── services/ ───┴──────────────────────────────┐
 │ bankApi (mock)  vault  activityLog  vaultKey  clock  crypto │
 │ sanitize  logger  prefs  haptics                            │
 └──▲───────────────▲───────────────▲───────────────▲──────────┘
  ══╪═══ TRUST BOUNDARY: everything below is untrusted ══════════
    │ PARSE (zod)   │ PARSE (zod)   │ DECRYPT      │ PARSE (zod)
 fixtures JSON   MMKV "vault"    SecureStore     MMKV "prefs"
 (bank data)     AES-256 file    vault key       theme, timers
```

| Layer | Owns | Imports |
| --- | --- | --- |
| `models/` | zod schemas and inferred types | Nothing |
| `services/` | All I/O: mock bank API, vault, key, log, prefs, clock, crypto, logger, sanitiser. Nothing unparsed leaves this layer | `models/` |
| `features/` | Domain logic, hooks and screens per feature | `services/`, `models/`, `components/` |
| `components/` | Design-system primitives: `Amount`, `Key`, `ReceiptSlip`, `Stamp`, `Tag`, `Segmented`, `Toast` | Nothing app-specific |
| `app/` | expo-router routes only. Each route renders a feature screen | `features/` |

**Data rules**

| Step | Place | Rule |
| --- | --- | --- |
| Parse | `services/bankApi.ts`, `vault.ts`, `prefs.ts` | Every read goes through `safeParse`. Bad records are dropped and counted |
| Mask | `features/transactions/selectors.ts` | `toView(tx, revealed)` returns `amount: number \| null`. Components never see a `Transaction`. `Amount` renders coins for `null` |
| Encrypt | `services/vault.ts` | MMKV AES-256 with a random key |
| Drop on lock | `features/auth/session.tsx` | `queryClient.clear()`, drop the add draft, drop decrypted vault objects |
| Drop on sign-out or erase | `services/vaultKey.ts` | Delete the key, then `deleteMMKV('vault')` |

Honest limit: while revealed, amounts sit in JS memory and in the query cache. Masking keeps them out of the rendered tree, not out of the process.

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
  postedAt: string               // ISO 8601
  reference: string
  account: { name: string; last4: string }
  source: 'bank' | 'manual'      // bank rows are read-only
}

type LoadError =
  | { kind: 'offline' } | { kind: 'timeout' } | { kind: 'server' }
  | { kind: 'invalid_data'; skipped: number }
```

Unions make impossible states unrepresentable. Each screen handles every `kind`.

## Mock bank API

- About 40 fixture transactions across several weeks. They use realistic Malaysian merchants, a few pending rows and a salary credit.
- Latency is random between 300 and 900 ms. "Slow network" adds 3 s.
- The reviewer controls in Settings force `offline`, `timeout`, `server` or bad data on the next request.
- "New transaction on refresh" returns one new row.
- Every response is parsed with `TransactionSchema.array()`. Bad rows become `invalid_data` with a skipped count, never a crash.
- History merges bank rows (memory only) with vault rows (`source: 'manual'`).

**Query wiring**
- `useTransactions()` wraps `useQuery`. Its `refetch` and `isRefetching` drive `RefreshControl`.
- Retry covers transient errors only: `(n, e) => e.kind !== 'invalid_data' && n < 2`.
- No persisted query client. Bank data is never written to disk.

## Auth and session

One pure reducer in `features/auth/machine.ts`. It holds no timers. Effects live in hooks that dispatch events.

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

**Step-up.** One hook, `useStepUp(action)`. It is never cached: every write prompts, every time.

| Action | Prompt | On success | On cancel |
| --- | --- | --- | --- |
| `reveal` | "Reveal amounts" | `revealed{until: now + revealSeconds}` | Stay masked, silently |
| `add` | "Save this transaction" | Vault write, log `tx.added` | "Not saved. Your draft is still here." |
| `delete` | "Delete this transaction" | Vault delete, log `tx.deleted` | Sheet stays |
| `clearLog` | "Clear security activity" | Log cleared, one `log.cleared` entry left | Nothing |
| `erase` | "Erase transactions you added" | Key destroyed, vault recreated empty, log `vault.erased` | Nothing |

Undo inside the 6 s toast skips the prompt. It only reverts what the user just authorised, and it is logged.

**`authenticateAsync` options.**
- `biometricsSecurityLevel: 'strong'`.
- `disableDeviceFallback: false`, so the device passcode still works. How these two combine on a phone with only weak biometrics isn't documented. Test on a device.
- A ref guard blocks a second prompt while one is open.

**Error codes**

| Codes | Meaning | UI |
| --- | --- | --- |
| `user_cancel`, `system_cancel`, `app_cancel` | Cancelled | Return silently. Not an error |
| `authentication_failed` | No match | Inline message, retry |
| `lockout` | Locked out | Cool-down card, device passcode |
| `not_enrolled`, `passcode_not_set` | Not set up | Explain, open device settings, passcode |
| `not_available` | No hardware | Explain, passcode |
| `user_fallback` | Chose passcode | Continue with fallback |
| `timeout`, `unable_to_process`, `unknown` and others | Unknown | Generic retry |

**Lock triggers**

| Trigger | Mechanism |
| --- | --- |
| Background | AppState `background` re-masks at once and stores `backgroundedAt` |
| Return | On `active`, lock if `now − backgroundedAt > relockAfter`. Never auto-prompt |
| Idle | `onTouchStart` on the root resets `lastTouch`. A 15 s tick compares it with `idleLock`. The tick pauses in background |
| Reveal expiry | The same tick compares with `until` |
| Manual | "Lock now" |

**The iOS inactive trap.** The Face ID sheet itself sends the app to `inactive` and back. So:
- `isAuthenticatingRef` is set before the prompt and cleared in `finally`. AppState changes are ignored while it is set.
- Only `background` locks or re-masks. `inactive` only shows the privacy cover.
- The machine ignores `BACKGROUND` while in `authenticating` or `stepUp`.

**On `LOCK`:**
- Clear the query cache.
- Drop the draft and close the add modal.
- Drop decrypted vault objects.
- Re-mask.

The guard flips and expo-router removes the protected history (V). A deep link that arrives while locked is not replayed after unlock. The user lands on History.

## Storage

| Store | API | Holds | Encrypted |
| --- | --- | --- | --- |
| `prefs` | `createMMKV({ id: 'prefs' })` | theme, `revealSeconds`, `idleLock`, `relockAfter`, `senMotion`, `haptics`, `demo.*` | No. Nothing sensitive |
| `vault` | `createMMKV({ id: 'vault', encryptionKey, encryptionType: 'AES-256' })` | `tx:<id>` added rows, `log` (last 50 events), `idem:<key>`, `meta` | Yes |
| SecureStore `sen.vaultKey.v1` | `expo-secure-store` | The vault key | Keychain or Keystore |

**MMKV facts** (V, `react-native-mmkv@4.3.2` source).
- **Encryption.** AES-128 is the default. The AES-256 key is at most 32 bytes, and longer keys throw.
- **Changing keys.** `recrypt` is deprecated. Use `encrypt` and `decrypt`.
- **Deleting.** `deleteMMKV(id)` removes a store.
- **Tests.** Under Jest, MMKV is an in-memory mock that ignores encryption. So `vault.ts` takes a `KeyValueStore` port that tests can fake.

**Key.**
- `getRandomValues(new Uint8Array(24))` encoded as base64url gives 32 ASCII characters, with 192 bits of entropy.
- It is stored with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`. It is readable only while the phone is unlocked and is never restored to another device (V).

**Why not `requireAuthentication`.** It would bind the key to biometrics, which is stronger in theory. It is skipped for three reasons (V, expo-secure-store 57.0.4 source):
- On Android, it prompts with `BIOMETRIC_STRONG` only and offers no device passcode fallback. The README promises that fallback.
- Keys are invalidated when biometrics change. Enrolling a new fingerprint would silently destroy the user's data.
- It adds a second prompt unless it replaces the unlock prompt.

The async read does not block the JS thread. So the key is unlocked-device-only, and the biometric gate is the JS step-up. The README states this limit.

**Lifecycle**

| Event | What happens |
| --- | --- |
| First unlock | Generate and store the key, create the vault, write `meta { schema: 1, createdAt }` |
| Unlock | Read the key, open the vault, parse every record |
| Lock | Keep files. Drop decrypted objects |
| Sign out | Delete the key, `deleteMMKV('vault')`, `prefs.clearAll()` |
| Erase | Delete the key and the vault, recreate empty with a fresh key, log `vault.erased` |
| Key missing, vault present | Backup restore or reinstall. Unreadable by design. Delete the vault, start clean, log `vault.reset_missing_key` |
| Vault unreadable | Same, log `vault.reset_corrupt` |
| One bad record | Drop it, count it, show "1 item couldn't be read" |
| SecureStore write fails | Nothing stored. "Couldn't save securely." The draft stays |

**Records.**
- Every record is `{ v: 1, data }`, parsed by a `z.discriminatedUnion('v', …)`.
- Unknown versions are dropped, not guessed.
- JSON is parsed inside a `try`.

**Activity log.**
- At most 50 entries `{ id, at, code, meta? }`.
- `code` is an enum: `unlock.ok`, `unlock.fail`, `lockout`, `reveal`, `reveal.expired`, `tx.added`, `tx.deleted`, `tx.undo`, `setting.changed`, `log.cleared`, `vault.erased`, `idle.lock` and so on.
- The schema has no amount field, so an amount can't be logged by mistake.
- Sign-out destroys the log with the vault. The new log starts with the next unlock.

**Backups.**
- **Android.** `android.allowBackup: false` (its default is `true`, V).
- **iOS.** MMKV files live in `Documents/`, which is backed up. A restored vault is ciphertext with no key, because the key is `THIS_DEVICE_ONLY`. It is wiped on first unlock (I).

## Add form input

| Field | Rule | Where |
| --- | --- | --- |
| Amount | Integer sen, 1 to 5,000,000 (RM 0.01 to RM 50,000.00) | `models/draft.ts` |
| Keypad | Digits shift in from the right. At most 7 digits. No decimal key, so no float ever exists | `features/add/keypadReducer.ts` |
| Direction | `'debit' \| 'credit'`. The sign is never typed | `models/draft.ts` |
| Description | Cleaned, then 2 to 60 characters. Cleaning means NFC, removing control, zero-width and bidi override or isolate characters, collapsing spaces and trimming | `services/sanitize.ts` |
| Description input | `autoCorrect={false}`, `autoComplete="off"`, `spellCheck={false}`, `textContentType="none"`, `importantForAutofill="no"` | `features/add/DetailsStep.tsx` |
| Category | Enum: food and drink, transport, bills, shopping, groceries, health, transfer, other | `models/category.ts` |
| Date | Today back to 90 days. Never future. From `services/clock.ts` | `models/draft.ts` |

**Why a custom keypad.** The system keyboard learns, suggests and syncs what you type, and third-party keyboards can send keystrokes off the device. A keypad of buttons means no amount ever reaches a keyboard. The input space is also exactly ten digits and delete.

**Idempotency.**
- **Draft key.** The draft gets `idemKey = randomUUID()` when the modal opens. `vault.add()` returns the existing row if the key was already used.
- **Single save.** The Save key disables, and an in-flight ref is set before the prompt.
- **References.** Each saved row gets `SEN-M-` plus 8 characters. The characters come from `getRandomValues` over a 32-letter alphabet with no look-alike letters.

## Threat model

Sen has no server. Everything it protects is on the phone.

| # | Threat | Controls | Where | How a reviewer sees it |
| --- | --- | --- | --- | --- |
| T1 | Someone holding the unlocked phone | Lock on launch, `Stack.Protected`, step-up for every write, idle lock, re-lock after background | `app/_layout.tsx`, `features/auth/*` | Kill and reopen: Lock. Delete: Face ID every time |
| T2 | Shoulder surfing | Masked by default, reveal times out (30 s to 2 min) | `features/transactions/selectors.ts` | The ring counts down, then coins |
| T3 | App switcher snapshot | Privacy cover on `inactive` plus `enableAppSwitcherProtectionAsync` (iOS). FLAG_SECURE app-wide (Android) | `features/auth/PrivacyCover.tsx`, `features/security/useScreenGuard.ts` | Open recents |
| T4 | Screenshots and recording | `usePreventScreenCapture` on sensitive screens, iOS 13+ and Android | `features/security/useScreenGuard.ts` | Screenshot on Review: blocked |
| T5 | Malicious or malformed input | Custom keypad, integer sen, zod limits, sanitiser | `features/add/`, `models/draft.ts`, `services/sanitize.ts` | Paste RTL marks: stripped |
| T6 | Tampered or corrupt store | zod on every vault read, drop and count, reset on unreadable vault | `services/vault.ts` | Dev menu "Corrupt vault" |
| T7 | Leaks via logs, crash reports, clipboard, accessibility, devtools | Mask at the source. Logger takes event codes only and is a no-op in release. Clipboard gets the reference only. Cache cleared on lock | `selectors.ts`, `services/logger.ts` | No `console.` outside the logger |
| T8 | Deep links that skip the lock | Guard re-evaluates on every navigation | `app/_layout.tsx` | `adb shell am start -d sen://transaction/x`: Lock |
| T9 | Double submit | Idempotency key, in-flight ref, disabled key | `features/add/useSaveDraft.ts`, `services/vault.ts` | Tap Save twice fast: one row |
| T10 | Backup extraction | `allowBackup: false`, `THIS_DEVICE_ONLY` key | `app.config.ts`, `services/vaultKey.ts` | Inspect `AndroidManifest.xml` |
| T11 | Bad data from the "API" | `TransactionSchema` parse at the boundary | `services/bankApi.ts` | Reviewer control "Bad data" |

**Out of scope, on purpose**

| Item | Why |
| --- | --- |
| Root or jailbreak detection | Easily patched, false positives, extra dependency |
| Certificate pinning | No real server, no TLS to pin |
| Server-side auth and tokens | No backend. Biometrics gate the UI. They don't prove identity to anyone |
| Runtime hooking of `authenticateAsync` | The step-up result is a JS boolean. Without a server or a biometric-bound key it can be faked |
| A rooted OS or malicious keyboard with root | Nothing an app can do |

## Tests

Unit and component tests with `jest-expo` and RNTL v14. Each security property has a test.

| Property | File |
| --- | --- |
| Masked view has no amounts (the masked list's JSON contains no amount digits) | `features/transactions/selectors.test.ts` |
| Every state and event pair is legal. `BACKGROUND` during `authenticating` is ignored | `features/auth/machine.test.ts` |
| Re-lock window (59 s stays, 61 s locks) with a fake clock | `features/auth/useAppStateLock.test.ts` |
| Idle lock and reveal expiry | `features/auth/useIdleLock.test.ts` |
| Lock drops the cache and the draft | `features/auth/session.test.tsx` |
| Step-up prompts every time with `'strong'`. Cancel writes nothing | `features/auth/useStepUp.test.ts` |
| Locked deep link renders Lock | `app/__tests__/guard.test.tsx` |
| Idempotency, corrupt records dropped | `services/vault.test.ts` |
| Key shape and storage options, missing key resets, erase and sign-out delete | `services/vaultKey.test.ts` |
| Log schema rejects amounts | `services/activityLog.test.ts` |
| Input limits, keypad cap | `models/draft.test.ts`, `features/add/keypadReducer.test.ts` |
| Sanitiser | `services/sanitize.test.ts` |
| zod issues carry no input | `models/transaction.test.ts` |
| Bad fixture becomes `invalid_data` with a count | `services/bankApi.test.ts` |
| Formatting: sign, split numerals, spoken amounts | `models/money.test.ts` |

## Builds and delivery

**Development.** Develop on WSL2 with no Mac.
- Android dev builds run locally with `npx expo run:android`, using the SDK at `~/Android/Sdk` and JDK 17.
- Builds install on a phone over Tailscale.
- `ANDROID_HOME` and `adb` on `PATH` still need setting up.

**Reviewers.**

| Route | Status |
| --- | --- |
| Android APK from EAS Build (`preview` profile), linked from the README and a GitHub release | Primary. Real fingerprint, no account, no Metro |
| Run from source on an Android emulator | Secondary |
| iOS simulator build from EAS | Bonus for reviewers with a Mac. Needs no Apple account (V). Building it from WSL is untested, so try it early |
| iOS device or TestFlight | No. Needs a paid Apple account |
| Expo Go | Not supported |

**EAS.**
- The free plan gives 15 Android and 15 iOS builds a month in a slow queue.
- Build on tags only.
- Keep `npx expo install expo@^58 --fix` ready in case SDK 58 ships before submission.

**Biometrics on emulators.**
- **Android.** Set a PIN, enrol a fingerprint, then run `adb -e emu finger touch 1`.
- **iOS Simulator.** Features › Face ID › Enrolled, then Matching or Non-matching.

**CI.**
- GitHub Actions on every push: `tsc --noEmit`, `expo lint` and `jest --ci`, on Node 22.13 or later.
- An EAS Android build on a tag, using `expo/expo-github-action@v8` and `EXPO_TOKEN`.
