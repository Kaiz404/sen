# Sen design

The visual and interaction spec for Sen. It is locked as of 2026-10-15. Every screen, state and flow below is drawn on the design canvas, on the "Take-home: Transaction history" page under "Round 5: Sen final": https://claude.ai/artifact/8d2qRf6GtxCL9bog1E41fF. Boards there are named `SF-*`.

Other directions were tried and dropped. They stay on the canvas above round 5 for reference only. Build from round 5 and this file.

## Thesis

**Private by default, and you can see it.** Amounts start hidden, and Sen, the coin mascot, keeps its eyes shut until you prove it's you. The look is loud and warm. It uses condensed display type, receipt-slip records and one bold fill per screen. It should feel premium and fun, and still read as a trustworthy finance app.

## Foundations

### Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F6F2E9` cream | `#121315` | Screen background |
| `paper` | `#FFFDF8` | `#1E2023` | Cards, receipt slips, inputs |
| `ink` | `#17181A` | `#F3EEE3` | Text, key borders and shadows |
| `ink-muted` | `#5F5A50` | `#ABA595` | Secondary text, mono captions |
| `rule` | `#E2DACA` | `#34373B` | Dashed dividers, input borders |
| `chip` | `#ECE5D6` | `#2A2C30` | Segmented control track |
| `lemon` | `#F2DC72` | `#F2DC72` | Primary keys, masked coins, Sen's face |
| `lilac` | `#C9B6F0` | `#C9B6F0` | Month summary card |
| `mint` | `#8ECF9D` | `#8ECF9D` | Switches on, success |
| `deep` | `#236B47` | `#8ECF9D` (as text) | Credits (`+RM`), Sen's rim and features |
| `stamp` | `#8A4B12` | `#F5BE98` | Rubber stamps |
| `pending` | `#7A3F0C` | `#F5BE98` | PENDING tag |
| `danger` | `#8A2E1F` | `#F4A493` | Destructive actions, validation errors |
| `hero` | `#17181A` | `#1E2023` | The ink hero on Lock |
| `on-hero` | `#FFFDF8` | `#FFFDF8` | Text on the hero |
| `on-hero-muted` | `#D8D2C4` | `#D8D2C4` | Secondary text on the hero |
| `key-plate` | `#17181A` | `#000000` | The hard shadow under a key |
| `key-edge` | `#17181A` | `#4A4E55` | Paper key border |
| `loud` | `#17181A` | `#F2DC72` | The screen's one loud fill, such as "+ Add" and the revealed hero |
| `on-loud` | `#F2DC72` | `#17181A` | Text on the loud fill |
| `shimmer` | `#F7F2E8` | `#34373B` | Skeleton highlight band. Dark has no board, so it uses `rule` (inferred) |
| `leader` | `#C9BFAA` | `#4A4D52` | Dotted leaders before totals |

Row glyph pastels: `#F9D5D0`, `#CBEBD3`, `#E6DDF8`, `#F8EDBF`, `#FBDCC8`, `#D2EEEA`. Every glyph shape is a slightly different blob.

Rules:
- One loud fill per screen. Lemon or ink carries the hero.
- Stamps are outlined ink, never filled.
- Text contrast is at least 4.5:1. Deep mint fails on dark backgrounds, so credits use `#8ECF9D` in dark mode.
- Tokens live in one typed Unistyles theme (`src/theme/`). Screens use semantic names, never raw hex.

### Type

| Role | Face | Setting |
| --- | --- | --- |
| Words (titles, keys, day headers) | Bricolage Grotesque 800 | Width 75, uppercase, tight |
| Numbers (amounts) | Bricolage Grotesque 800 | Width 100, tabular lining figures, `-0.035em` |
| Receipt lines, captions, references | IBM Plex Mono 500/600 | Captions in caps with `0.12em` tracking |
| Body | System (SF Pro, Roboto) | |

- **Split numerals.** Heroes set ringgit large and the sen digits under half that size: `RM 2,317` + `.40`.
- **Credits.** Deep mint with an explicit `+`. Debits get a `−` added by hand, because Hermes `Intl` lacks `signDisplay` on iOS.
- **Width axis on Android.** Use the static Condensed ExtraBold cuts that the upstream Bricolage repo ships. Embed them with the `expo-font` config plugin.

### Shape and parts

- **Keys.**
  - Primary and secondary actions are "keys": a 2 px ink border, a 4 px hard ink shadow below and 15 to 20 px radius.
  - On press, a key drops 4 px and loses its shadow.
- **Receipt slips.**
  - They frame day groups, the detail record, the add review and the reviewer controls.
  - A slip has a perforated top, a zigzag bottom, dashed rules between rows and dotted leaders before totals.
- **Masked amounts.**
  - `RM` followed by **always four** small lemon coins with an ink edge. Never the real digit count.
  - Screen readers hear "Amount hidden".
- **Grain.** A 6% multiply noise overlay sits on screen backgrounds.
- **Icons.** Material Design Icons (`MaterialCommunityIcons` in `@expo/vector-icons`).
- **Touch targets.** At least 44 pt.

## Sen, the mascot

Sen is a one-sen coin with a face and two paws. It is drawn as layered SVG (`react-native-svg`) and animated with Reanimated. The idle and masked art is in `assets/brand/`.

### Anatomy

Rig units: 1 unit = size / 600 pt. Origin at the face centre.

| Part | Shape | Notes |
| --- | --- | --- |
| `rim` | Circle r 262 at (10, 16), deep mint | The coin edge. The offset gives a hint of depth |
| `face` | Circle r 222, lemon | Fixed |
| `lk` (face group) | Eyes and mouth | Slides across the disc. Clipped to the face circle so it can tuck behind the rim |
| `eye-l`, `eye-r` | Ellipse rx 14 ry 20 at (∓72, −38), plus a closed arc | Open and closed crossfade. Blink is scaleY |
| `mouth` | Six pre-drawn paths: smile, small, grin, frown, flat, o | Crossfade, never morph |
| `paw-l`, `paw-r` | Ellipse rx 46 ry 36 at (∓106, 152), deep mint | Wave, perch, hold one prop, celebrate. **Never cover the eyes.** The lower face is fine, as in `worried` |
| `cheeks` | Two ellipses, opacity 0 to 0.3 | Happy only |
| Props | Magnifier, plug, nightcap, sunglasses | One per moment |
| Accents | 3 sparkle stars, 3 ticks, 1 swoosh | Separate layer. Launch, unlock, reveal and copy only |

Sen's colours are the same in light and dark mode. In copy, Sen is "Sen" or "it", never "he" or "she".

### Size tiers

| Size | Where | Drawn |
| --- | --- | --- |
| Under 48 pt | Header mark, toasts, app icon | Face and eyes only |
| 48 to 120 pt | Cards, sheets | Full rig. Ambient blink by default. The director can still play moments such as Reveal on it |
| Over 120 pt | Launch, welcome, lock, lockout, errors, empty states | Full rig, full motion |

### Poses

| Pose | Face | Paws | Means |
| --- | --- | --- | --- |
| `idle` | Eyes open, smile | Rest | Default |
| `masked` | Eyes closed arcs, face tucked to (0, 34), small mouth | Rest | Amounts hidden |
| `peek` | Face slid to (22, 24), right eye a crack, body leans −2.4° | Rest | Face ID in progress |
| `revealed` | Face up to (0, −8), eyes open, grin, cheeks | Rest | Amounts showing |
| `happy` | Happy squint arcs, grin, cheeks | Up at the rim (∓128, −180) | Unlock, reveal success, saved, copied |
| `look` | Face slid to (64, −44), body +2.6° | Rest | Watching something, such as the amount being typed |
| `lookdown` | Face slid to (−64, 70) | Rest | Glancing at the ring |
| `worried` | Smaller eyes nudged in, frown, body −4° | Clutch the rim | Auth failed, network error (with plug) |
| `asleep` | Closed eyes, face tucked to (0, 48), nightcap | Folded | Lockout, app switcher cover |
| `shrug` | Face (−16, −14), flat mouth | Out and up | Empty search (with magnifier), not found, Face ID off |
| `squint` | Eyes (1.15, 0.35), flat mouth | Rest | Switched to light mode |
| `cool` | Sunglasses | Rest | Switched to dark mode |

### Placement

- Sen lives on edges. It perches on the month card, peeks over receipt slips, rises out of the pull-to-refresh gap and leans in from the side on errors.
- Never centred on a blank screen. Never over an amount.
- Only one Sen animates on screen at a time.

## Motion

Damped and calm. Every spring has one clean overshoot. The Euler settle is the only repeated wobble. Idle is almost still.

References: Phantom's onboarding (tilted mid-motion character, flat sparkle accents) and Abode (characters living inside UI and peeking from behind cards, one prop each).

### Rig for Reanimated

- Body transforms run on nested `Animated.View` wrappers, outside in: `mv` (translate) › `rl` (rotate about the coin centre) › `sq` (rotate, skewX and scale about the contact point (10, 278)) › `sp` (scaleX for the edge spin). Pivots use a static `transformOrigin`.
- Face parts are SVG `G` elements driven by `useAnimatedProps`, transformed with a worklet-computed `matrix`. Keep the number of SVG nodes changing per frame near 12, and measure it.
- Wrap `lk` in a static `G` with `clipPath` (the face circle) so the clip stays put while the face slides.
- The implementation model (channels, moments as data) is in ARCHITECTURE.md › Motion.

```ts
const EASE = {
  out:  Easing.bezier(0.2, 0.8, 0.2, 1),   // arrivals, eye moves
  inQ:  Easing.in(Easing.quad),            // falls, exits
  outQ: Easing.out(Easing.quad),           // rises
  sine: Easing.inOut(Easing.sin),          // holds, returns
  inS:  Easing.in(Easing.sin),             // spin toward edge-on
  outS: Easing.out(Easing.sin),            // spin away from edge-on
};
const SPRING = {
  pop:    { damping: 14, stiffness: 260, mass: 0.7 }, // ~15% overshoot
  settle: { damping: 18, stiffness: 220, mass: 0.8 }, // ~5%
  soft:   { damping: 20, stiffness: 140, mass: 1 },   // no visible overshoot
};
const RM = { reduceMotion: ReduceMotion.System };     // spread into every config
```

### Primitives

| Primitive | Duration | What moves |
| --- | --- | --- |
| blink | 140 ms | Eyes scaleY 1 › 0.1 (60 ms, inQ) › 1 (80 ms, outQ). Optional double blink after 90 ms |
| look-left/right | 1.3 s with hold | `lk` x ∓26 (140 ms, out) with one blink. Body leans ∓2.6° at +80 ms (settle). Back at 1100 ms |
| lean-in | 640 ms | Counter-lean +2° (100 ms), then −7° and skewX 10° (pop). Eyes lead by 80 ms |
| squash-hop | 700 ms | Squash 1.12/0.86 › rise −80 (230 ms, outQ) › stretch › fall (170 ms, inQ) › land squash 1.16/0.84 › pop |
| wobble-settle (Euler) | ~1.15 s | Rotate ±A, A0 11°, A × 0.72 and duration × 0.8 per swing, 10 swings. Final clack 1.03/0.97 › settle. Build the step array once |
| edge-spin | 240 ms per quarter | θ drives `sp` scaleX = cos θ. Heads and tails swap on sign. An edge pill shows near edge-on. Stop by springing to the next 2πk so it lands heads |
| flip | 960 ms | Squash › arc −150 › θ 0 to 4π linear › land squash › pop |
| roll | 900 ms in, 550 ms out | `rl` rotate derived from translateX / 262. Skew into travel. Eyes lead the exit |
| eye-close | 450 ms | Eyes squeeze to 0.15 › closed arcs spring in › face tucks to (0, 34) › mouth small |
| eye-pop | 420 ms | Face presses to 46 › springs up to −8 (pop) › eyes open 0.1 › 1.12 › 1 › small hop › grin, cheeks, accents |
| eye-peek | 240 ms open, 160 ms back | Face slides to (22, 24) › right eye opens a crack (1.05, 0.45) › one blink › back |
| face-slide | 240 ms, body +80 ms | Face slides to a target: ring (−64, 70), card (64, −44), pull gap (0, −60). Hide at (120, 168) or (−28, 190) |
| squint | 800 ms | Eyes (1.15, 0.35), recoil +6, flat mouth |
| shrug | 1.3 s | Face (−16, −14), paws out and up (∓70, −80), body squash and lift −14, one bounce back |
| accent-pop | 900 ms | Stars 0.2 › 1.18 › 1 with 50 ms stagger, ticks fly out, swoosh draws on, all fade at 600 ms, then unmount |

### App moments

| Moment | Trigger | Sequence | Haptic |
| --- | --- | --- | --- |
| Launch | Cold start | Sen drops in as the full stop of "SEN", squashes, eyes pop open, waves, blinks. Loop until ready | None |
| Idle | 4 to 7 s with no touch | Blink 70%, look with blink 20%, double blink 10%. After 3 beats, wait 10 to 15 s | None |
| Lock, waiting | Lock screen | Masked pose. Every 6 to 9 s, eye-peek toward Unlock, blink, close | None |
| Face ID in progress | Prompt open | Peek left and right in a 1.6 s loop | None |
| Auth failed | Prompt fails | Eyes pop, face shakes ±16, lean back 4°, frown, paws clutch, eyes close at 1.5 s | Error |
| Unlock | Auth succeeds | eye-pop with paws up › accent-pop › one flip › land. 1.35 s | Success at 160 ms |
| Reveal | Reveal auth succeeds | eye-pop and small hop › digits roll in at 200 ms › face slides toward the digits › accents › happy squint | Success at 200 ms |
| Re-mask | Timeout, Hide now, background | eye-close › face ducks behind the rim › settles masked. Dots replace digits at 120 ms. On background, set the pose instantly | Hide now only: Light |
| Pull to refresh | Pull past 72 pt, release | Gesture-driven stretch out of the gap › edge-spin while loading (at least 600 ms) › stops on heads › lands › wobble-settle › "Updated" pill | Selection at threshold, Light on land |
| Empty search | 0 results, 300 ms after typing stops | Rises from behind the slip, looks left and right with the magnifier, shrugs, sinks half hidden | None |
| Network error | Fetch fails | Worried, leans back −8°, paws hold the plug. Slow blink every 4 to 7 s. On Retry, glances at the button | Warning, once |
| Lockout | Biometric lockout | Asleep with nightcap › sigh squash › spins edge-on › breathes › turns back when the cool-down ends | Error |
| Copy | Reference copied | Small hop out from the slip, paws up, grin, accents. 800 ms | Light |
| Saved, added | Add succeeds | As unlock, smaller. Row slides in under Today | Success |
| Theme change | Theme switches while active | To light: hard squint and recoil, sunglasses drop in. To dark: squint, scan, relax | Selection (in-app toggle only) |

### Motion rules

- **Reduced motion.**
  - Read the system setting live through `useMotionPolicy()`. Reanimated's `useReducedMotion()` never updates.
  - Pose changes become 150 ms crossfades, built from the moment data, and blinks stay. The lockout cool-down keeps counting.
  - Hops, spins, flips, rolls, wobbles, stretch and accents are dropped.
  - Haptics still fire.
  - The Settings choice "Sen's animations: Calm" does the same.
- **Never during scroll.**
  - Pause on scroll start and resume 1.5 s after momentum ends.
  - Pull-to-refresh is direct manipulation, so it is allowed.
- **One attention motion at a time.**
  - A single `MotionDirector` owns every Sen and plays moments by priority:
    - P3: error and lockout.
    - P2: unlock, reveal and re-mask.
    - P1: copy, refresh, empty search, save and theme.
    - P0: idle and glances.
  - A higher priority cancels a lower one.
  - An equal priority queues at most one moment.
  - P0 moments are dropped, never queued.
- **Off screen.** Nothing plays when the screen is unfocused or the app isn't active.
- **Performance.**
  - Body transforms run natively on View wrappers.
  - The mouth crossfades instead of morphing.
  - Accents unmount after they play.

### Haptics

One haptic per moment, fired from the named step, not at gesture start.
- **iOS.** Uses `expo-haptics`.
- **Android.** Uses `performAndroidHapticsAsync`.

| Event | iOS | Android |
| --- | --- | --- |
| Unlock, reveal, saved | `notificationAsync(Success)` | `AndroidHaptics.Confirm` |
| Auth failed, lockout | `notificationAsync(Error)` | `AndroidHaptics.Reject` |
| Network error | `notificationAsync(Warning)` | `AndroidHaptics.Reject` |
| Copy, refresh landed, Hide now | `impactAsync(Light)` | `Context_Click`, `Clock_Tick`, `Toggle_Off` |
| Segmented controls, refresh threshold | `selectionAsync()` | `Segment_Tick` |

## Screens

| Board | Screen | Key content |
| --- | --- | --- |
| `SF-Launch` | Launch | Ink full bleed. Sen drops in as the full stop of "SEN" |
| `SF-Welcome` | Welcome (first run) | "Meet Sen." Three promises on a receipt slip. "Continue as demo user" |
| `SF-Biometric` | Face ID primer (first run) | Explains biometrics before the OS prompt. "Turn on Face ID", "Use device passcode instead" |
| `SF-Lock` | Lock | "Welcome back." Large masked Sen on the ink hero. Demo profile row. Unlock, passcode, "Not you? Start again" |
| `SF-LockStates` | Lock states | Checking, didn't match ("2 more tries"), lockout with cool-down, Face ID off, unlocked |
| `SF-PrivacyCover` | App switcher cover | Lemon full bleed, wordmark, Sen asleep. No amounts or names |
| `SF-History` | History, masked | Header with face-only Sen mark, "+ Add", settings and lock keys. "OCTOBER" title. Lilac month card with Sen perched, masked money out and in, "Show amounts". Search, All/In/Out, day slips with masked rows and day nets |
| `SF-Reveal` | History, revealed | Ink card with Sen on top. Split numerals. "Hide amounts". The board's 60 s ring and countdown are dropped (D27) |
| `SF-HistoryStates` | History states | Last 10 s, search results with count and total, empty search, In filter, pull-to-refresh, updated pill with new row, skeleton, offline banner over cached list, full error |
| `SF-Detail` | Detail, masked | Receipt hero with coins, Sen peeking over the slip, status chip, reveal key, facts table, reference with Copy |
| `SF-DetailRevealed` | Detail, revealed | Split hero, pending stamp, Authorised › Pending › Posted timeline, copy toast, "Share receipt" |
| `SF-DetailStates` | Detail states | Skeleton, share text preview, not found, error with Retry |
| `SF-DetailManual` | Detail, added by you | ADDED BY YOU stamp, "Added on this phone" source row, "Delete transaction". Bank rows read "From your bank · read only" |
| `SF-AddAmount` | Add 1/3, amount | Money out or in. Huge amount. Custom 3 × 4 keypad. Sen watching |
| `SF-AddDetails` | Add 2/3, details | Description with counter, 8 category chips, Today / Yesterday / Pick a date, live mini receipt |
| `SF-AddReview` | Add 3/3, review | Full draft receipt with reference, Sen peeking, "Save with Face ID". Screenshots blocked |
| `SF-AddStates` | Add states | Validation errors, Face ID checking, cancelled, couldn't save securely, discard draft, saved with Undo |
| `SF-DeleteStates` | Delete states | Confirm sheet, Face ID step-up, deleted with Undo, Face ID failed |
| `SF-Settings` | Settings | See below |
| `SF-SettingsSheets` | Settings sheets | Privacy explainer, sign-out confirm, reset demo confirm, lockout armed, switched to dark |
| `SF-SecurityActivity` | Security activity | Day-grouped mono log of the last 50 events. Never amounts. "Clear log" needs Face ID |
| `SF-Dark-*` | Dark mode | Lock, History, Reveal, Detail, Add review, Settings |
| `SF-Flow`, `SF-FlowAdd` | Flow maps | Every screen, transition and branch |
| `SF-Bible` | Bible | Sen sizes, poses, placement, palette, type, receipt parts, haptics |
| `SF-SecArch`, `SF-Threats` | Security boards | Architecture and threat model, see [ARCHITECTURE.md](ARCHITECTURE.md) |

Sample data used on the boards: Everyday Savings ·· 4821, 1 to 15 October. Rows include Tealive (pending), DuitNow from Aisyah Rahman (in), Grab ride to KL Sentral (pending), TNB electricity RM 142.60 (pending, the detail sample), Shopee, Touch 'n Go eWallet reload, Salary (in), GrabFood, and one added row, "Lunch with Hafiz, cash" (RM 42.50).

## Flows

**First run.**
- Launch › Welcome › "Continue as demo user" › Face ID primer › OS prompt › History (masked).
- The passcode path also lands on History.
- If biometrics aren't set up, the primer offers "Open device settings" and "Use device passcode".

**Returning.**
- Launch › Lock › tap Unlock. Never auto-prompt.
- **Success.** Unlock moment, then History (masked).
- **Cancel.** Back to Lock silently.
- **No match.** An inline message with the tries left.
- **Lockout.** The cool-down card and the passcode.

**Show and hide amounts.**
- History › "Show amounts" › OS prompt › revealed.
- One setting covers every screen, including Detail.
- Amounts stay shown, through lock, unlock and restart, until "Hide amounts" on History or the Settings switch.
- Hiding never prompts. Showing always does.

**Detail.**
- Tap a row › Detail, masked or revealed to match the session.
- Copy reference shows a toast.
- "Share receipt" opens the system share sheet with plain text. It only shows when revealed.
- Back keeps the scroll position.

**Refresh.**
- Pull › Sen rises › release › Sen spins › lands.
- The "Updated just now" pill appears and one new transaction slides in.

**Search and filter.**
- Typing filters by description live.
- A result line shows the count and the total, masked or revealed.
- No results shows Sen with the magnifier and "Clear search".
- In and Out recompute the month card.

**Add.**
- History "+ Add" › amount › details › review › "Save with Face ID" › OS prompt › History.
- The new row slides in under Today with the stamp, then a 6 s "Undo" toast. Undo inside the window doesn't ask for Face ID.
- **Face ID cancelled.** "Not saved. Your draft is still here."
- **Store fails.** "Couldn't save securely. Nothing was stored." with Retry.
- **Close with input.** "Discard this draft?"
- **Re-lock.** The draft is dropped.

**Delete.** Added rows only.
- Detail › "Delete transaction" › confirm › Face ID › History.
- A 6 s "Undo" toast follows.

**Errors.**
- **First load fails.** Full-screen error with Sen and the plug, and Retry.
- **Refresh fails.** The cached list stays, with an offline banner.
- **Timeout and server errors.** Each has its own copy.
- **Bad data.** Valid rows stay, with a skipped count.
- **Stale detail.** "This transaction isn't here any more."

**Background.**
- `inactive` shows the privacy cover on iOS. Android never emits `inactive`, so FLAG_SECURE blanks the recents view there.
- Returning after the "Lock again" window goes to Lock.
- Idle past "Lock when idle" also goes to Lock.

## Settings

Preferences live in plain MMKV (`prefs`). Nothing sensitive is stored there.

| Section | Control | Options | Default | Key |
| --- | --- | --- | --- | --- |
| Profile slip | Demo user · Everyday Savings ·· 4821 · SIMULATED DATA | | | |
| Appearance | Theme | Light · Dark · System | System | `theme` |
| Security | Hide amounts | On · Off | On | `hideAmounts`. Turning it off asks for biometrics |
| Security | Lock when idle | 2 · 5 · 10 min | 5 min | `idleLock` |
| Security | Lock again after leaving | Right away · 1 min · 5 min | 1 min | `relockAfter` |
| Security | Face ID for adding and deleting | Always on (info row) | | |
| Security | Hide Sen in the app switcher | Always on (info row) | | |
| Security | Block screenshots on sensitive screens | Always on, iOS 13+ and Android (info row) | | |
| Security | Security activity | Pushed screen | | |
| Security | Erase transactions I added | Destructive. Face ID and confirm | | |
| Sen | Sen's animations | Full · Calm · Off. System Reduce Motion forces Calm | Full | `senMotion` |
| Sen | Haptics | Switch | On | `haptics` |
| For reviewers | Next history request | Normal · Offline · Timeout · Server error · Bad data | Normal | `demo.next` |
| For reviewers | Dataset size | 20 · 1k · 10k. Resets bank rows only, then syncs with a progress line | 1k | `demo.datasetSize` |
| For reviewers | Slow network, add 3 s | Switch | Off | `demo.slow` |
| For reviewers | New transaction on refresh | Switch | On | `demo.newOnRefresh` |
| For reviewers | Simulate Face ID lockout | Button. Arms the next unlock to report lockout | | |
| For reviewers | Reset demo data | Button with confirm | | |
| About | How Sen keeps amounts private | Explainer sheet | | |
| About | Source code, licences | Links | | |
| Account | Lock now | Key | | |
| Account | Sign out of demo | Destructive, with confirm. Destroys the database key and clears prefs | | |

Footer: `SEN 1.0.0 (1) · SIMULATED DATA`.

## Copy and accessibility

- Short, warm and plain. Malaysian context: RM, DuitNow, TNB, Grab, Touch 'n Go.
- No invented stats. Unknowns are placeholders like `[REPO URL]`.
- **Masked amounts.**
  - The container is labelled "Amount hidden", with the hint "Double tap to reveal with Face ID".
  - The coins are hidden from screen readers.
- **Revealed amounts.** Spoken as words, such as "Minus 42 ringgit 50".
- **Announcements.** Reveal and re-mask are announced with `AccessibilityInfo.announceForAccessibility`.
- **Semantics.** Real buttons and switches with labels. Icon-only buttons get a label.
