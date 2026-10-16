import { dark, light, type ColorToken, type Palette } from './colors';
import { type } from './type';

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const TEXT: readonly ColorToken[] = ['ink', 'inkMuted', 'deep', 'stamp', 'pending', 'danger'];
const SURFACES: readonly ColorToken[] = ['canvas', 'paper'];

describe.each([
  ['light', light],
  ['dark', dark],
] as [string, Palette][])('%s text tokens', (_, palette) => {
  test.each(TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const)))(
    '%s on %s is at least 4.5:1',
    (fg, bg) => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );
});

test('type roles scale em tracking to the size', () => {
  expect(type.numerals(64)).toEqual({
    fontFamily: 'BricolageGrotesque-ExtraBold',
    fontSize: 64,
    letterSpacing: -2.24,
    fontVariant: ['tabular-nums', 'lining-nums'],
  });
  expect(type.caption()).toEqual({
    fontFamily: 'IBMPlexMono',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  });
  expect(type.words(48)).toEqual({
    fontFamily: 'BricolageGrotesque96ptCondensed-ExtraBold',
    fontSize: 48,
    letterSpacing: -0.24,
    textTransform: 'uppercase',
  });
});

test('the plate on a pastel card is the same paper plate in both modes, and its text reads on it', () => {
  const tokens = ['plate', 'plateInk', 'plateFaint', 'plateCredit'] as const;
  expect(tokens.map((t) => dark[t])).toEqual(tokens.map((t) => light[t]));
  for (const t of ['plateInk', 'plateFaint', 'plateCredit'] as const)
    expect(contrast(dark[t], dark.plate)).toBeGreaterThanOrEqual(4.5);
});
