import type { Palette } from '@/theme/colors';

/**
 * Board colours that have no token in src/theme yet. Each maps to the nearest existing token per theme, so
 * promoting them into the theme later is a change to this one table.
 */
export function standIn(colors: Palette, themeName: string | undefined) {
  const dark = themeName === 'dark';
  return {
    /** Key shadow plate. Board: ink in light, #000000 in dark. */
    keyPlate: dark ? colors.canvas : colors.ink,
    /** Paper key border. Board: ink in light, #4A4E55 in dark. */
    keyEdge: dark ? colors.rule : colors.ink,
    /** The one loud fill per screen (the Add key, hero cards). Board: ink in light, lemon in dark. */
    loud: dark ? colors.lemon : colors.ink,
    onLoud: dark ? colors.onPastel : colors.lemon,
    /** Skeleton highlight band. Board: #F7F2E8 in light. No dark board. */
    shimmer: dark ? colors.rule : colors.canvas,
  };
}
