import { dark, light, type Palette } from '@/theme/colors';

import config from '../../app.config';

type Pair = { light: string; dark: string };

function datePickerColors(): Record<string, Pair> {
  const entry = (config.plugins ?? []).find(
    (p) => Array.isArray(p) && p[0] === '@react-native-community/datetimepicker',
  ) as [string, { android: { datePicker: Record<string, Pair> } }] | undefined;
  return entry?.[1].android.datePicker ?? {};
}

/** The config file cannot import the app's source (Expo loads it alone), so it repeats these hex values. */
const TOKENS: Record<string, readonly [keyof Palette, keyof Palette]> = {
  colorAccent: ['loud', 'loud'],
  textColorPrimary: ['ink', 'ink'],
  textColorSecondary: ['inkMuted', 'inkMuted'],
  windowBackground: ['canvas', 'canvas'],
  textColorPrimaryInverse: ['canvas', 'onLoud'],
  textColorSecondaryInverse: ['onHeroMuted', 'plateInk'],
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test('the Android dialog colours are the light and dark tokens', () => {
  const colors = datePickerColors();
  expect(Object.keys(colors).sort()).toEqual(Object.keys(TOKENS).sort());
  for (const [attr, [l, d]] of Object.entries(TOKENS)) {
    expect(colors[attr]).toEqual({ light: light[l], dark: dark[d] });
  }
});

test.each(['light', 'dark'] as const)(
  'the %s dialog text reads at AA on its backgrounds',
  (mode) => {
    const c = datePickerColors();
    const pick = (attr: string) => c[attr]![mode];
    expect(contrast(pick('textColorPrimary'), pick('windowBackground'))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(pick('textColorSecondary'), pick('windowBackground'))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(pick('textColorPrimaryInverse'), pick('colorAccent'))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(pick('textColorSecondaryInverse'), pick('colorAccent'))).toBeGreaterThanOrEqual(
      4.5,
    );
  },
);

test('the release manifest blocks the draw-over-other-apps permission', () => {
  expect(config.android?.blockedPermissions).toContain('android.permission.SYSTEM_ALERT_WINDOW');
});
