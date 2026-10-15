/**
 * DESIGN.md › Colour. `deep` is the credits colour: deep green on cream, mint on dark, because deep green
 * fails 4.5:1 there. Credits read `colors.deep` in both modes with no branch.
 */
const LIGHT = {
  canvas: '#F6F2E9',
  paper: '#FFFDF8',
  ink: '#17181A',
  inkMuted: '#5F5A50',
  rule: '#E2DACA',
  chip: '#ECE5D6',
  lemon: '#F2DC72',
  lilac: '#C9B6F0',
  mint: '#8ECF9D',
  deep: '#236B47',
  stamp: '#8A4B12',
  pending: '#7A3F0C',
  danger: '#8A2E1F',
  /** Text and borders on a pastel fill (a lemon key, the lilac card). Pastels don't flip in dark, so neither does this. */
  onPastel: '#17181A',
} as const;

export type ColorToken = keyof typeof LIGHT;
export type Palette = Readonly<Record<ColorToken, string>>;

export const light: Palette = LIGHT;

export const dark: Palette = {
  canvas: '#121315',
  paper: '#1E2023',
  ink: '#F3EEE3',
  inkMuted: '#ABA595',
  rule: '#34373B',
  chip: '#2A2C30',
  lemon: '#F2DC72',
  lilac: '#C9B6F0',
  mint: '#8ECF9D',
  deep: '#8ECF9D',
  stamp: '#F5BE98',
  pending: '#F5BE98',
  danger: '#F4A493',
  onPastel: '#17181A',
};

/** Row glyph pastels, the same in both modes. A row picks one by a stable hash of its id. */
export const GLYPH_PASTELS = [
  '#F9D5D0',
  '#CBEBD3',
  '#E6DDF8',
  '#F8EDBF',
  '#FBDCC8',
  '#D2EEEA',
] as const;

/** Sen's own colours. Sen looks the same in light and dark, and its fills are SVG props, not styles. */
export const SEN_COLORS = {
  face: '#F2DC72',
  rim: '#236B47',
  feature: '#236B47',
  prop: '#17181A',
  glass: '#FFFDF8',
} as const;
