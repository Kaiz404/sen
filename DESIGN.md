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
| `lemon-edge`, `lemon-plate` | `#17181A`, `#17181A` | `#F2DC72`, `#8A7A2C` | A lemon key's border and shadow plate |
| `hero-raised` | `#26282C` | `#26282C` | A card on the hero, such as the lockout cool-down |
| `hero-accent` | `#F5BE98` | `#F5BE98` | The accent word on the lockout hero |

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

**Source of truth.** Sen's look and motion come from the canvas boards, copied into [`design/`](design/). The tables below summarise them and name the board selector each row comes from. Where a table and a board differ, the board wins, and the table gets fixed, unless an owner override below names the difference. `python3 -I scripts/board-keyframes.py <board>` prints any board's animations in milliseconds.

| Board | Holds |
| --- | --- |
| `design/MAX-Library.dc.html` | MAX · Motion primitives. The rig, the 15 primitives (`.L-*`), the accent layer and the house rules |
| `design/MAX-Moments.dc.html` | MAX · App moments, hands (interactive). Every app moment's keyframes and haptic beat (`.M-*`), and the static tiles that settle several poses |
| `design/MAX-Spec.dc.html` | MAX · Reanimated spec. Its Launch row is superseded by MAL2 |
| `design/MAL2-Loading.dc.html`, `design/MAL-Timelines.dc.html` | MAL2 · Sen is the dot. The launch, its timeline and the handoff to Lock. It supersedes `.M-launch`, MAX-Spec's Launch row, the `SF-Launch` board and every older launch |
| `design/kit.py` | Every pose as SVG, the geometry phase 1 ported |

**Owner overrides.** These win over the board they name.

| Date | Board | Override |
| --- | --- | --- |
| 2026-10-17 | MAX-Moments `.M-lockout` | Sen never spins edge-on into the pill. It naps in the `asleep` pose and breathes for the whole lockout. The owner found the edge-on hold odd |
| 2026-10-17 | MAX `.tl` | The coin back is Bunga (option B on `SF-CoinBack-Options`): a five-petal flower with a lemon eye, in a thin ring, no numeral. It replaces the plus-and-bar tails. It is symmetric, so the mirror leaves it unchanged. Currency Act 2020 s.19 rules out anything that resembles a Malaysian coin, so no numeral, no crest, no denomination |

Poses come from kit.py, MAX-Moments' static tiles (`.M-err`, `.M-last`, `.M-lockout`, `.M-lock`) and the held frames of MAX-Library's primitives (`.L-peek`, `.L-slide`, `.L-shrug`, `.L-squint`). MAX-Library holds no pose sheet.

### Anatomy

Rig units: 1 unit = size / 600 pt. Origin at the face centre.

| Part | Board | Shape | Notes |
| --- | --- | --- | --- |
| Rim | | Circle r 262 at (10, 16), deep mint | The coin edge. The offset gives a hint of depth |
| Back | `.tl` (owner override) | Ring r 176 stroked 12, five petals (ellipses rx 46.2 ry 68.2, 81.4 from the centre, every 72°) as paths, a lemon eye r 28.6 and a deep mint dot r 12.1, all about (0, 4) | Seen mid-spin only, while `cos θ < 0`. Drawn at x = 20 because `sp` mirrors about x = 10 |
| Face | | Circle r 222, lemon | Fixed |
| Face group | `.lk` | Eyes, mouth and sunglasses | Slides across the disc. Clipped to the face circle so it can tuck behind the rim |
| Eyes | `.el` › `.elb`, `.elc` | Three layers per eye. The pose layer (offset and scale) holds an open ellipse rx 14 ry 20 at (∓72, −38) and a closed arc | A pose holds its eye shape on the pose layer. Blinks, eye-close, peek cracks and squints run on the open and shut layers (scale and opacity), so they play over any held pose. The closed arc scales about its own box centre (∓72, −34) |
| Mouth | `.mo` | Six pre-drawn paths: smile, small, grin, frown, flat, o | Crossfade, never morph. The group scales about the smile's centre (MAL2's wink, 1.6 by 1.8) |
| Paws | `.pl` › `.plf` | Ellipse rx 46 ry 36 at (∓106, 152), deep mint. Two layers per paw, each with translate, rotate and scale | The pose layer waves, perches and celebrates. The secondary layer trails a lean or a hop. A held prop rides the right paw's secondary layer, behind the paw. **Never cover the eyes.** The lower face is fine, as in `worried` |
| Cheeks | `.ck` | Two ellipses, opacity 0 to 0.3 | Happy, revealed and copy |
| Props | `.cap`, `.shades`, `.prop` | Magnifier, plug, nightcap, sunglasses | One per moment. The nightcap sits above the clip. The sunglasses ride the face group. The cap and sunglasses can move, tilt and fade |
| Accents | `.fx`, `.fxb` | 3 sparkle stars (filled, stroked 10 with round joins), 3 ticks (stroked 18), 1 swoosh (`M-330 60 Q-330 250 -140 300`, stroked 44, round caps) | Inside `mv`, so they follow travel but never the spin. The swoosh draws behind the coin. Stars and ticks draw in front. Launch, unlock, reveal and copy only |

Sen's colours are the same in light and dark mode. In copy, Sen is "Sen" or "it", never "he" or "she".

Accent colours follow the surface Sen sits on (MAX-Moments `--fx` and `--sw`). Tokens: `SEN_ACCENT_TONES` in `src/theme/colors.ts`.

| Surface | Stars and ticks | Swoosh |
| --- | --- | --- |
| Pastel, such as a lilac card (`onPastel`) | Ink `#17181A` | Paper `rgba(255,253,248,.75)` |
| Ink hero (`onHero`) | Lemon `#F2DC72` | Lemon `rgba(242,220,114,.22)` |
| Cream canvas (`onCanvas`) | Deep `#236B47` | Deep `rgba(35,107,71,.16)` |

### Size tiers

| Size | Where | Drawn |
| --- | --- | --- |
| Under 48 pt | Header mark, toasts, app icon | Face and eyes only |
| 48 to 120 pt | Cards, sheets | Full rig. Ambient blink by default. The director can still play moments such as Reveal on it |
| Over 120 pt | Launch, welcome, lock, lockout, errors, empty states | Full rig, full motion |

### Poses

Every lean pairs with a counter skewX, as on the boards. "Body" is `sq` (rotate, skewX and scale about the contact point) and `mv` (lift).

| Pose | Board | Face | Body | Paws | Means |
| --- | --- | --- | --- | --- | --- |
| `idle` | kit.py | Eyes open, smile | Rest | Rest | Default |
| `masked` | `.M-lock` | Eyes closed arcs, face tucked to (0, 34), small mouth | Rest | Rest | Amounts hidden |
| `peek` | `.L-peek` | Face slid to (22, 24), left eye shut, right eye a crack (1.05, 0.45), small mouth | Leans −2.4°, skewX 2° | Rest | Face ID in progress |
| `revealed` | `.M-reveal` | Face up to (0, −6), eyes open, grin, cheeks | Rest | Rest | Amounts showing |
| `happy` | `.M-last` | Face (0, −6), open eyes squinted to (1.15, 0.45), grin, cheeks | Rest | Up at the rim (∓128, −180) | Unlock, reveal success, saved, copied |
| `look` | `.L-slide` | Face slid to (64, −44) | Leans 2.6°, skewX −2.4° | Rest | Watching something, such as the amount being typed |
| `lookdown` | `.L-slide` | Face slid to (−64, 70) | Leans −3°, skewX 3° | Rest | Glancing at the ring |
| `worried` | `.M-err` | Eyes at 0.85 nudged in to (±10, 8), frown | Leans −4°, skewX 3° | Clutch the rim at (±66, −56), scale 0.9 | Auth failed, network error (with plug) |
| `asleep` | `.M-lockout` | Closed eyes, face tucked to (0, 48), nightcap | Rest | Folded (±36, −6) | Lockout, app switcher cover |
| `shrug` | `.L-shrug` | Face (−16, −14), flat mouth | Lifts 14, stretches 0.98 by 1.03, leans 2°, skewX −2° | Out and up at (∓70, −80), turned ∓20° | Empty search (with magnifier), not found, Face ID off |
| `squint` | `.L-squint` | Eyes (1.15, 0.35), flat mouth | Rest | Rest | Switched to dark mode, mid adjustment. The moment relaxes to idle |
| `cool` | `.M-dark` | Sunglasses | Rest | Rest | Switched to light mode. The sunglasses stay on |

- `revealed` and `happy` settle the face at (0, −6), MAX-Moments' settled value (`.M-unlock`, `.M-reveal`). MAX-Library's eye-pop primitive stops at −8.
- `shrug` uses MAX-Library's primitive. MAX-Moments' Empty search ends with the right paw at (20, −70), holding the magnifier.

### Placement

- Sen lives on edges. It perches on the month card, peeks over receipt slips, rises out of the pull-to-refresh gap and leans in from the side on errors.
- Never centred on a blank screen. Never over an amount.
- Only one Sen animates on screen at a time.

### App icon

The icon is the brand wordmark: "Sen." in paper on ink, with Sen as the full stop, as in MAL2's last frame. The word is Bricolage 800 at width 100 with −0.04 em tracking. Sen sits on the baseline at 1.2 times the wordmark's size, so the lemon still reads as a coin at 48 px. It is face only, idle, with no hands. The word and coin fill Android's 66 dp safe circle. Square icons (iOS, Android before 8) frame 80 dp. The background is ink, so the launch grows from the icon into the ink splash with no colour change. Themed icons get one silhouette with the face knocked out. iOS tinted gets a grey drawing on black. `npm run icons` builds the SVG sources in `design/icon/` and the PNGs in `assets/images/`.

## Motion

Damped and calm. Every spring has one clean overshoot. The Euler settle is the only repeated wobble. Idle is almost still.

References: Phantom's onboarding (tilted mid-motion character, flat sparkle accents) and Abode (characters living inside UI and peeking from behind cards, one prop each).

### Rig for Reanimated

- Body transforms run on nested `Animated.View` wrappers, outside in: `mv` (translate and the rig's opacity) › `rl` (rotate about the coin centre) › `sq` (rotate, skewX and scale about the contact point (10, 278)) › `sp` (scaleX for the edge spin). Pivots use a static `transformOrigin`.
- `sp`'s scaleX is `cos θ`, never closer to zero than 0.02, so the coin keeps a sliver edge-on.
- The edge pill draws in its own SVG inside `sq`, after `sp`, so it never takes the spin's scale. It shows while `|cos θ| < 0.12`.
- Accents draw in two SVG layers inside `mv`: the swoosh before `rl`, behind the coin, and the stars and ticks after it. They follow travel and never the spin.
- Face parts are SVG `G` elements driven by `useAnimatedProps`, transformed with a worklet-computed `matrix`. Keep the number of SVG nodes changing per frame near 12, and measure it.
- Wrap `lk` in a static `G` with `clipPath` (the face circle) so the clip stays put while the face slides.
- The implementation model (channels, layers, moments as data) is in ARCHITECTURE.md › Motion.

Easing and springs live in `src/motion/tokens.ts`, which is the one source. Every curve is a cubic bezier, so Reanimated, `kf` and CSS transitions share it.

| Token | Bezier or spring | Use |
| --- | --- | --- |
| `out` | (0.2, 0.8, 0.2, 1) | Arrivals, eye moves |
| `inQ` | (0.55, 0.085, 0.68, 0.53) | Falls, exits |
| `outQ` | (0.25, 0.46, 0.45, 0.94) | Rises |
| `sine` | (0.37, 0, 0.63, 1) | Holds, returns |
| `inS` | (0.12, 0, 0.39, 0) | Spin toward edge-on |
| `outS` | (0.61, 1, 0.88, 1) | Spin away from edge-on |
| `malSpring` | (0.34, 1.56, 0.64, 1) | MAL2's landings, one overshoot |
| `handoff` | (0.3, 1.25, 0.5, 1) | Sen grows into Lock's Sen |
| `hopOut`, `hopIn` | (0.2, 0.7, 0.4, 1), (0.6, 0, 0.8, 0.3) | Rising out of a hop, falling into a landing |
| `SPRING.pop` | damping 14, stiffness 260, mass 0.7 | About 15% overshoot |
| `SPRING.settle` | damping 18, stiffness 220, mass 0.8 | About 5% |
| `SPRING.soft` | damping 20, stiffness 140, mass 1 | No visible overshoot |
| `SPRING.launch` | damping 12, stiffness 180, mass 1 | `malSpring` as a spring |

Reduced motion comes from `useMotionPolicy()`, never `ReduceMotion.System` (ARCHITECTURE.md › Motion levels).

### Primitives

Each row is a MAX-Library tile. Its board selector holds the keyframes.

| Primitive | Board | Duration | What moves |
| --- | --- | --- | --- |
| blink | `.L-blink` | 140 ms | Open layer scaleY 1 › 0.1 (60 ms, inQ) › 1 (80 ms, outQ). Optional double blink after 90 ms |
| look-left/right | `.L-look` | 1.3 s with hold | `lk` x ∓26 (140 ms, out) with one blink. Body leans ∓2.6° with skewX ±2.4° at +80 ms (settle, overshooting to ∓3.4°). Back at 1100 ms |
| lean-in | `.L-lean` | 640 ms | Counter-lean +2° with skewX −3° (100 ms), then −7° with skewX 10° and 0.97 by 1.03 (pop). Face leads to (−22, −6) by 80 ms. Paws trail +14 on the secondary layer |
| squash-hop | `.L-hop` | 700 ms | Squash 1.12/0.86 › rise −80 (230 ms, outQ) › stretch with −2° and skewX 4° › fall (170 ms, inQ) › land squash 1.16/0.84 › pop. Paws bounce 18, −12, 10 on the secondary layer. Eyes squash to 0.6 on landing |
| wobble-settle (Euler) | `.L-wob` | ~1.15 s | Rotate ±A, A0 11°, A × 0.72 and duration × 0.8 per swing, 10 swings. Final clack 1.03/0.97 › settle. Build the step array once |
| edge-spin | `.L-edge` | 240 ms, then 600 ms per turn | θ drives `sp` scaleX = cos θ, never closer to zero than 0.02. The first quarter runs 240 ms inS to edge-on, then θ turns linearly at 600 ms per turn. Heads and tails swap on the sign. The edge pill shows while `\|cos θ\| < 0.12`. Stop by springing to the next 2πk so it lands heads |
| flip | `.L-flip` | 960 ms | Squash › arc −150 › θ 0 to 4π linear › land squash › pop |
| roll | `.L-roll` | 900 ms in, 550 ms out | `rl` rotate derived from translateX / 262. Skew into travel. Eyes lead the exit |
| eye-close | `.L-close` | 450 ms | Open layer squeezes to 1.1 by 0.15 › closed arcs spring in (0.7/0.3 › 1.08/1.15 › 1) › face tucks to (0, 34) › mouth small |
| eye-pop | `.L-pop` | 420 ms | Face presses to 46 › springs up to −8 (pop) › eyes open 0.1 › 1.12 › 1 › small hop › grin, cheeks, accents |
| eye-peek | `.L-peek` | 240 ms open, 160 ms back | Face slides to (22, 24) › body leans −2.4° with skewX 2° at +80 ms › right eye opens a crack (1.05, 0.45) › one blink › back |
| face-slide | `.L-slide` | 240 ms, body +80 ms | Face slides to a target: ring (−64, 70), card (64, −44), pull gap (0, −60). Body leans ±3° with skewX ∓3° toward it. Hide at (120, 168) or (−28, 190) |
| squint | `.L-squint` | 800 ms | Eyes (1.15, 0.35), recoil +6, flat mouth |
| shrug | `.L-shrug` | 1.3 s | Face (−16, −14), paws out and up (∓70, −80) and turned ∓20°, body squash 1.04/0.96 then stretch 0.98/1.03 with 2° and skewX −2°, lift −14, one bounce back |
| accent-pop | `.L-fx`, `.L-pop` | 900 ms | Stars 0.2 › 1.18 › 1 with 50 ms stagger, ticks fly out, swoosh draws on, all fade at 600 ms, then unmount |

### App moments

Each row is a MAX-Moments tile unless it names another board.

| Moment | Board | Trigger | Sequence | Haptic |
| --- | --- | --- | --- | --- |
| Launch | MAL2 (`MAL2-Loading`, `MAL-Timelines`) | Cold start | Sen is the dot. Frame 0 is the splash: "Sen" with no period, and Sen small (0.22) off to the left, stretched and leaning −6°. 0 to 380 ms it falls onto the S. 380 to 710 ms it hops to the e, and 710 to 1050 ms to the n, each letter dipping as it lands. 1050 to 1510 ms it leaps to the period with the swoosh trailing. At 1512 ms it lands as the period: squash 1.3/0.7, then spring, with sparkles and ticks. 1720 to 1830 ms it winks (right eye scaleY 0.12, smile scaled 1.6 by 1.8, cheeks). 1930 to 2100 ms it settles into the period. Handoff 2400 to 3110 ms: Sen grows into Lock's Sen while the ink panel shrinks into Lock's hero, the wordmark rises and fades, and Lock's UI fades in. The loader unmounts at 3110 ms. Loop 4200 ms. Wait loop: a small hop on the period, 600 ms, no haptic. Lock's Sen rests masked while MAL2 ends with open eyes, so from 2800 ms, inside the handoff, the eyes squeeze shut, the face tucks to (0, 34) and the mouth goes small, timed as MAX-Library's eye-close (not on the board). The loader unmounts at 3276 ms, once Lock's UI has faded in. **First run.** The same launch plays into Welcome, handing off to Welcome's Sen and hero with its eyes open, as MAL2 ends, and that Sen then eases into `happy` to wave hello. A brand launch that plays on every cold start whatever the first screen is the common pattern, and the first run is the launch a reviewer sees first. Supersedes `.M-launch`, MAX-Spec's Launch row and the `SF-Launch` board | Light impact at 1512 ms, the `launch` event |
| Idle | `.M-idle` | 4 to 7 s with no touch | Eyes only, no body motion. Blink 70%, look with blink 20% (face to (−22, 0) and back), double blink 10%. After 3 beats, wait 10 to 15 s | None |
| Lock, waiting | `.M-lock` | Lock screen | Masked pose. Every 6 to 9 s the face slides to (20, 26) toward Unlock, the right eye opens a crack (1.05, 0.45), blinks once, and closes. No lean | None |
| Face ID in progress | `.M-face.ph-scan` | Prompt open | Peek left (−20, 24) with the left eye cracked, then right (20, 24) with the right eye, in a 1.6 s loop | None |
| Auth failed | `.M-face.ph-fail` | Prompt fails | Eyes pop open at 0.9, face shakes ±16 and settles at (0, 10), counter-lean then lean back to −4° with skewX 4°, frown, paws clutch (±40, −24) at 0.9, eyes close at 1.5 s | Error |
| Unlock | `.M-unlock` | Auth succeeds. Plays when a Sen's pose goes from `masked` to `happy` | eye-pop with paws up › face settles at (0, −6) › accent-pop › one flip › land. Happy squint (1.15, 0.45) from 1250 ms. 1.35 s | Success at 160 ms |
| Reveal | `.M-reveal` | Amounts shown, after biometrics (D27: a saved setting, no timer). Plays when a Sen's pose goes from `masked` to `revealed` | eye-pop and small hop, paws up › digits roll in at 200 ms › face at (0, −6) › accents › face slides toward the digits (18, −10) at 640 ms › happy squint (1.15, 0.45). Accents pop before the slide. The tile then loops back to masked, but amounts stay shown, so from 1500 ms Sen eases into `revealed` in 300 ms on `sine`, the tile's own paw-drop time and curve. 1.8 s | Success when the check passes, fired by History, so it comes once even when a scroll or the background holds Sen still |
| Re-mask | `.M-remask` | "Hide amounts" on History or in Settings (D27). Plays when a Sen's pose goes from `revealed` to `masked` | From 600 ms on the tile: eye-close › face ducks behind the rim (−28, 190) › settles masked at (0, 34) while Sen leans back behind the card, then the lean eases out from 1000 ms in 350 ms. It starts from `revealed`, so the eyes squeeze from open and the paws are already down. Dots replace digits at 120 ms. 1.35 s | Hide now only: Light, fired by the control |
| Pull to refresh | `.M-ref` | Pull past 72 pt, release | Gesture-driven stretch out of the gap › edge-spin while loading: `refreshSpin` (240 ms to edge-on) then the `refreshSpinLoop` lap, one turn per 600 ms › `refreshLand`: the spin springs to the next heads-up turn while Sen rises 100 in 120 ms (not on the tile, which starts in the air) › drops › lands › wobble-settle, 6 swings from 8° › "Updated" pill | Selection at threshold, Light on land |
| Empty search | `.M-empty` | 0 results, 300 ms after typing stops | Rises from behind the slip, looks left and right with the magnifier, shrugs, then eases into the `shrug` pose in 200 ms instead of sinking, since the screen keeps that pose. It opens 70 units down, hidden by the slip. 3.5 s | None |
| Network error | `.M-err` | Fetch fails | Worried, leans back to −8° with skewX 7°, holds at −6.5° with 5.5°, then returns to the worried lean. Paws squeeze the plug on the secondary layer (0.9). Slow blink every 4 to 7 s. On Retry, glances at the button | Warning, once |
| Lockout | `.M-lockout`, less its spin (owner override) | Biometric lockout | Asleep with nightcap › sigh squash, then still (`lockout`, 1.3 s) › breathes face-on, scaleY 1.02 every 4 s, through the whole cool-down (`lockoutBreathe`, a loop that follows on its own). It never turns edge-on | Error |
| Copy | `.M-copy` | Reference copied | Hop −60 out from the slip, paws up (∓60, −90), happy squint, grin, cheeks, accents. The squint relaxes from 1500 ms, so 1.64 s. The tile perches at a lean of 3° with skewX −4°, which no pose holds, so the hop starts and ends upright | Light |
| Saved, added | No board | Add succeeds | As unlock, smaller. Copy's hop and accents with the success haptic. Row slides in under Today | Success |
| Theme change | `.M-dark` | Theme switches while active | To light: hard squint (1.2, 0.3) and recoil +8, then the sunglasses drop in with one overshoot and stay (ends `cool`). To dark: the sunglasses lift off as at the end of `.ph-light`, squint (1.15, 0.5), eyes scan ±12, relax with a blink (ends `idle`). Each plays when a Sen's pose goes between `idle` and `cool` | In-app toggle only: Selection, Android `Toggle_On` or `Toggle_Off` |

### Motion rules

- **House rules** (MAX-Library).
  - Eyes lead. The body follows 80 ms later.
  - Lean into a move: tilt and shear about the contact point, not only scale.
  - Quick anticipation, one clean overshoot, settle.
  - Accents pop on launch, unlock, reveal and copy only, then leave.
- **Ambient loops.** kit.py's `bob` and `breathe` loops are not used, because idle is eyes only (MAX-Spec). The lockout keeps its breathing.
- **Reduced motion.**
  - Read the system setting live through `useMotionPolicy()`. Reanimated's `useReducedMotion()` never updates.
  - Pose changes become 150 ms crossfades, built from the moment data, and blinks stay. The lockout cool-down keeps counting.
  - Hops, spins, flips, rolls, wobbles, stretch and accents are dropped.
  - Haptics still fire, except at launch.
  - **Launch.** Show the rest frame, hold 400 ms, then crossfade to Lock in 200 ms. No travel, no accents, no haptic (MAL-Timelines).
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
| Launch landing (`launch`) | `impactAsync(Light)` | `Context_Click`. MAL-Timelines names no Android constant, so it takes the one Copy's light impact uses (inferred: closest to a light tap) |
| Copy, refresh landed, Hide amounts | `impactAsync(Light)` | `Context_Click`, `Clock_Tick`, `Toggle_Off` |
| Segmented controls, refresh threshold | `selectionAsync()` | `Segment_Tick` |
| Theme change, in-app toggle only | `selectionAsync()` | `Toggle_On` or `Toggle_Off`, matching the new state (inferred: MAX-Moments names both without a mapping) |

## Screens

| Board | Screen | Key content |
| --- | --- | --- |
| `SF-Launch` | Launch | Ink full bleed with the "Sen" wordmark. The motion follows MAL2 (`design/MAL2-Loading.dc.html`), where Sen becomes the period |
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
- **Success.** Unlock moment, then History (masked). History's data starts loading as the check passes, so it is ready when the moment ends.
- **Cancel.** Back to Lock silently.
- **No match.** An inline message with the tries left. After Auth failed, Sen rests `worried`, as the Lock board's "Not quite." state draws it, not masked as the tile ends.
- **Lockout.** The cool-down card and the passcode.

**Show and hide amounts.**
- History › "Show amounts" › OS prompt › revealed.
- One setting covers every screen, including Detail.
- Amounts stay shown, through lock, unlock and restart, until "Hide amounts" on History or the Settings switch.
- Hiding never prompts. Showing always does.

**Detail.**
- Tap a row › Detail, masked or revealed to match the session.
- The receipt's source box says where a row came from. A bank row reads "From your bank · read only" and has no delete key. An added row reads "Added on this phone" and shows "Delete transaction".
- The boards' receipt number ("NO. 1014-07"), settle date ("settles by Fri 16 Oct") and "Report a problem" link are left out. The model holds no such data and no backend takes reports.
- The Authorised › Pending › Posted timeline shows on a shown receipt of a pending bank payment. Its Posted step reads "NEXT", because the bank sends no settle date.
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
- **Simulated.** Every bank failure comes from a reviewer control, because the in-app bank never fails on its own. The banner's second line reads "Simulated · Change in Settings", and the full error's caption ends in "· SIMULATED" above its "Reviewer settings" link. Both open Settings at the reviewer controls. A fault lasts one request, so Retry recovers.

**Background.**
- `inactive` shows the privacy cover on iOS. Android never emits `inactive`, so FLAG_SECURE blanks the recents view there.
- Returning after the "Lock again" window goes to Lock.
- Idle past "Lock when idle" also goes to Lock.

## Settings

Preferences live in plain MMKV (`prefs`). Nothing sensitive is stored there. The screen follows `SF-Settings`, with the changes listed under the table.

| Section | Control | Options | Default | Key |
| --- | --- | --- | --- | --- |
| Profile slip | Demo user · Everyday Savings ·· 4821 · SIMULATED DATA, Sen peeking over it | | | |
| Appearance | Theme | Light · Dark · System, with a sun and a moon on the first two. System follows the phone | System | `theme` |
| Security | Hide amounts | Switch. Turning it off asks for biometrics | On | `hideAmounts` |
| Security | Lock when idle | 2 · 5 · 10 min | 5 min | `idleLock` |
| Security | Lock again after leaving | Right away · 1 min · 5 min | 1 min | `relockAfter` |
| Security | Fingerprint (or the phone's own biometric) for adding and deleting | Always on (info row) | | |
| Sen | Sen's animations | Full · Calm · Off, with a still Sen and one line for each. System Reduce Motion forces Calm | Full | `senMotion` |
| Sen | Haptics | Switch | On | `haptics` |
| For reviewers | Next history request | Normal · Offline · Timeout (8 s) · Server error 500 · Bad data. One-shot: back to Normal after one request | Normal | `demo.next` |
| For reviewers | Dataset size | 20 · 1k · 10k. Reloads bank rows only. The second line reads "Loading 1,500 of 10,000 rows…" while they load | 1k | `demo.datasetSize` |
| For reviewers | Slow network, add 3 s | Switch | Off | `demo.slow` |
| For reviewers | New transaction on refresh | Switch | On | `demo.newOnRefresh` |
| For reviewers | Simulate lockout | Button. Arms the next unlock to report lockout. Armed, it reads "Lockout armed · Tap again to disarm", and a toast offers Undo | | |
| For reviewers | Reset demo data | Sheet with confirm | | |
| About | How Sen keeps amounts private | Explainer sheet | | |
| Account | Lock now | Key | | |
| Account | Sign out of demo | Destructive, with a confirm sheet. Destroys the database key and clears prefs | | |

Footer: `SEN 1.0.0 · SIMULATED DATA`.

**Changes from the board.**
- "Reveal amounts for" is the "Hide amounts" switch, because amounts stay shown until hidden (D27).
- Dataset size joins the reviewer slip.
- History's fault states open Settings scrolled to the reviewer slip.
- Not built: the Source code and licences links (the README covers both). Security activity and Erase arrive with phase 5. The app switcher and screenshot rows are built, as ALWAYS ON info rows.

## Copy and accessibility

- Short, warm and plain. Malaysian context: RM, DuitNow, TNB, Grab, Touch 'n Go.
- No invented stats. Unknowns are placeholders like `[REPO URL]`.
- **Masked amounts.**
  - The container is labelled "Amount hidden", with the hint "Double tap to reveal with Face ID".
  - The coins are hidden from screen readers.
- **Revealed amounts.** Spoken as words, such as "Minus 42 ringgit 50 sen". The sen always gets its unit, so "42 ringgit 5 sen" never reads as 42.50.
- **Announcements.** Reveal and re-mask are announced with `AccessibilityInfo.announceForAccessibility`.
- **Semantics.** Real buttons and switches with labels. Icon-only buttons get a label.
