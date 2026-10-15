import { Platform, type TextStyle } from 'react-native';

/**
 * Family names as the expo-font plugin registers them in app.config.ts. Android resolves the declared family
 * plus `fontWeight`. iOS resolves each file's PostScript name (inferred, checked on the first iOS build).
 */
export const FONT = Platform.select({
  ios: {
    words: 'BricolageGrotesque96ptCondensed-ExtraBold',
    numerals: 'BricolageGrotesque-ExtraBold',
    mono500: 'IBMPlexMono-Medium',
    mono600: 'IBMPlexMono-SemiBold',
  },
  default: {
    words: 'BricolageGrotesque96ptCondensed-ExtraBold',
    numerals: 'BricolageGrotesque-ExtraBold',
    mono500: 'IBMPlexMono',
    mono600: 'IBMPlexMono',
  },
});

/**
 * What a role sets. Narrower than TextStyle: Unistyles rejects a spread of the full TextStyle (its `cursor`
 * is wider than Unistyles allows), and colour stays with the caller.
 */
export type TypeRole = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'textTransform' | 'fontVariant'
>;

/** DESIGN gives tracking in em and RN letter spacing is absolute, so every role is a function of size. */
const em = (value: number, size: number) => Math.round(value * size * 100) / 100;

/**
 * DESIGN.md › Type. Spread a role inside `StyleSheet.create` and add the colour beside it:
 *
 *   title: { ...type.words(48), color: theme.colors.ink }
 */
export const type = {
  /** Titles, keys, day headers, the wordmark. Bricolage Condensed 800, uppercase, tight. */
  words: (size: number): TypeRole => ({
    fontFamily: FONT.words,
    fontSize: size,
    letterSpacing: em(-0.005, size),
    textTransform: 'uppercase',
  }),
  /** Amounts. Bricolage 800 at width 100, tabular lining figures, -0.035em. */
  numerals: (size: number): TypeRole => ({
    fontFamily: FONT.numerals,
    fontSize: size,
    letterSpacing: em(-0.035, size),
    fontVariant: ['tabular-nums', 'lining-nums'],
  }),
  /** Receipt lines and references. IBM Plex Mono 500, or 600 for emphasis. */
  mono: (size: number, weight: 500 | 600 = 500): TypeRole => ({
    fontFamily: weight === 500 ? FONT.mono500 : FONT.mono600,
    fontWeight: weight === 500 ? '500' : '600',
    fontSize: size,
  }),
  /** Mono captions. Plex Mono 600, caps, 0.12em tracking. 11 pt on the boards. */
  caption: (size = 11): TypeRole => ({
    ...type.mono(size, 600),
    letterSpacing: em(0.12, size),
    textTransform: 'uppercase',
  }),
  /** Body copy in the system face. */
  body: (size: number): TypeRole => ({ fontSize: size }),
} as const;

/** Split numerals: the sen digits are set at under half the ringgit size. */
export const FRACTION_SCALE = 0.46;
