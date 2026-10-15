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
| D18 | Device driver | agent-device plus raw adb. No biometric bypass |
| D19 | Inner loop | `npm run check` plus a dev-only states gallery. No Expo web |
| D20 | Performance proof | Jest benches in CI, Flashlight at milestones |
| D21 | Git and CI | `main` only, a pre-commit hook and GitHub Actions |
| D22 | Build order | Serial scaffold and contracts, then parallel lanes |

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

**Fallback.** If SQLCipher won't build from WSL within two hours, use MMKV with a 1k-row cap.

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

**Fallback.** StyleSheet with typed tokens, if Unistyles clashes with Reanimated or the compiler.

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

The implementation details come from the motion research. See ARCHITECTURE.md › Motion.

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
2. Masking and the timed reveal.
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

## D18. Device driver: agent-device plus raw adb

**Compared.**
- agent-device.
- Raw adb only.
- Maestro.
- argent.

**Why.**
- **Built for agents.** agent-device taps by the labels a screen reader announces, so accessibility work doubles as testability.
- **Raw adb.** It covers fingerprint taps, deep links and logs.
- **Rejected options.** Maestro's YAML would read as the E2E suite we ruled out. argent isn't proven on Linux.
- **Real prompt.** Agents use the real biometric prompt. A bypass is the first thing a security reviewer looks for.
- **Screen guard.** Off in dev builds and forced on in release, so agent screenshots aren't black.

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
