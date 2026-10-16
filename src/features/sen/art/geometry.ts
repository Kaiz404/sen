import { SEN_ACCENT_TONES, SEN_COLORS, type SenAccentTone } from '@/theme/colors';

import type { MouthId, RigNode } from '../channels';
import type { PropId } from '../poses';

export const COIN_UNITS = 600;
export const VIEWBOX_UNITS = 680;
export const VIEWBOX = '-340 -340 680 680';

export type SenTier = 'face' | 'full';

export function senTier(size: number): SenTier {
  return size < 48 ? 'face' : 'full';
}

export function senBox(size: number): { side: number; inset: number; unit: number } {
  const unit = size / COIN_UNITS;
  return { side: VIEWBOX_UNITS * unit, inset: ((VIEWBOX_UNITS - COIN_UNITS) / 2) * unit, unit };
}

export type Vec = readonly [x: number, y: number];

export const PIVOT = {
  coin: [10, 16],
  contact: [10, 278],
} as const satisfies Record<string, Vec>;

/** An array, because React Native's string parser reads only whole-number percentages. */
export function transformOrigin([x, y]: Vec): [`${number}%`, `${number}%`, 0] {
  const pct = (v: number) => Math.round(((v + VIEWBOX_UNITS / 2) / VIEWBOX_UNITS) * 10000) / 100;
  return [`${pct(x)}%`, `${pct(y)}%`, 0];
}

type Paint = {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeLinejoin?: 'round';
  readonly strokeDasharray?: number;
  readonly opacity?: number;
};

export type Shape = Paint &
  (
    | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
    | {
        readonly kind: 'ellipse';
        readonly cx: number;
        readonly cy: number;
        readonly rx: number;
        readonly ry: number;
      }
    | {
        readonly kind: 'rect';
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
        readonly rx: number;
        readonly rotate?: readonly [deg: number, cx: number, cy: number];
      }
    | { readonly kind: 'path'; readonly d: string }
  );

const C = SEN_COLORS;
const line = (d: string, strokeWidth: number): Shape => ({
  kind: 'path',
  d,
  stroke: C.feature,
  strokeWidth,
});

export const RIM: Shape = { kind: 'circle', cx: 10, cy: 16, r: 262, fill: C.rim };
export const FACE: Shape = { kind: 'circle', cx: 0, cy: 0, r: 222, fill: C.face };
export const FACE_CLIP = { cx: 0, cy: 0, r: 222 } as const;

export const TAILS: readonly Shape[] = [
  { kind: 'circle', cx: 10, cy: 16, r: 262, fill: C.rim },
  { kind: 'circle', cx: 20, cy: 0, r: 222, fill: C.face },
  { kind: 'circle', cx: 20, cy: 0, r: 150, stroke: C.feature, strokeWidth: 18 },
  { kind: 'rect', x: 4, y: -84, width: 32, height: 168, rx: 16, fill: C.feature },
  { kind: 'rect', x: 4, y: -84, width: 64, height: 32, rx: 16, fill: C.feature },
];
export const EDGE: Shape = {
  kind: 'rect',
  x: -13,
  y: -246,
  width: 46,
  height: 524,
  rx: 23,
  fill: C.rim,
};

export const ORIGIN = {
  el: [-72, -38],
  elb: [-72, -38],
  elc: [-72, -34],
  er: [72, -38],
  erb: [72, -38],
  erc: [72, -34],
  mo: [0, 23.5],
  shades: [0, -41],
  cap: [63, -172.3],
  pl: [-106, 152],
  plf: [-106, 152],
  pr: [106, 152],
  prf: [106, 152],
} as const satisfies Partial<Record<RigNode, Vec>>;

const eyeOpen = (cx: number): Shape => ({
  kind: 'ellipse',
  cx,
  cy: -38,
  rx: 14,
  ry: 20,
  fill: C.feature,
});
export const EYE_OPEN = { L: eyeOpen(-72), R: eyeOpen(72) } as const;
export const EYE_SHUT = {
  L: line('M-92 -40 Q-72 -16 -52 -40', 13),
  R: line('M52 -40 Q72 -16 92 -40', 13),
} as const;

export const MOUTH: Readonly<Record<MouthId, Shape>> = {
  smile: line('M-16 20 Q0 34 16 20', 12),
  small: line('M-10 30 Q0 36 10 30', 12),
  grin: line('M-30 14 Q0 52 30 14', 14),
  frown: line('M-16 34 Q0 22 16 34', 12),
  flat: line('M-14 29 Q0 29 14 29', 12),
  o: { kind: 'ellipse', cx: 0, cy: 30, rx: 11, ry: 14, fill: C.feature },
};

export const CHEEKS: readonly Shape[] = [
  { kind: 'ellipse', cx: -128, cy: 34, rx: 28, ry: 17, fill: C.feature },
  { kind: 'ellipse', cx: 128, cy: 34, rx: 28, ry: 17, fill: C.feature },
];

export const PAW = {
  L: { kind: 'ellipse', cx: -106, cy: 152, rx: 46, ry: 36, fill: C.feature },
  R: { kind: 'ellipse', cx: 106, cy: 152, rx: 46, ry: 36, fill: C.feature },
} as const satisfies Record<'L' | 'R', Shape>;

export const PROP: Readonly<Record<PropId, readonly Shape[]>> = {
  magnifier: [
    { kind: 'circle', cx: 150, cy: 70, r: 52, stroke: C.prop, strokeWidth: 20 },
    { kind: 'circle', cx: 150, cy: 70, r: 40, fill: C.glass, opacity: 0.55 },
    {
      kind: 'rect',
      x: 96,
      y: 104,
      width: 24,
      height: 70,
      rx: 12,
      fill: C.prop,
      rotate: [38, 108, 139],
    },
  ],
  plug: [
    { kind: 'path', d: 'M170 120 Q240 150 236 230', stroke: C.prop, strokeWidth: 14 },
    { kind: 'rect', x: 128, y: 70, width: 84, height: 62, rx: 20, fill: C.prop },
    { kind: 'rect', x: 142, y: 38, width: 16, height: 40, rx: 8, fill: C.prop },
    { kind: 'rect', x: 182, y: 38, width: 16, height: 40, rx: 8, fill: C.prop },
  ],
  nightcap: [
    {
      kind: 'path',
      d: 'M-170 -150 Q-40 -330 150 -250 Q230 -200 250 -120 Q120 -230 -170 -150Z',
      fill: C.rim,
    },
    { kind: 'circle', cx: 262, cy: -104, r: 34, fill: C.face },
    { kind: 'circle', cx: 262, cy: -104, r: 34, stroke: C.rim, strokeWidth: 10 },
  ],
  shades: [
    { kind: 'rect', x: -118, y: -74, width: 96, height: 66, rx: 30, fill: C.prop },
    { kind: 'rect', x: 22, y: -74, width: 96, height: 66, rx: 30, fill: C.prop },
    { kind: 'rect', x: -30, y: -56, width: 60, height: 16, rx: 8, fill: C.prop },
  ],
};

const STAR_D = 'M0 -46 Q7 -7 46 0 Q7 7 0 46 Q-7 7 -46 0 Q-7 -7 0 -46Z';
const STARS: readonly { readonly at: Vec; readonly scale: number }[] = [
  { at: [-292, -236], scale: 1 },
  { at: [308, -150], scale: 0.62 },
  { at: [262, 238], scale: 0.45 },
];
/**
 * The swoosh's length in rig units. The boards draw it on with `pathLength="100"`, which
 * react-native-svg supports only on web, so the rig dashes by the real length instead: a board dash
 * offset `d` is `d * SWOOSH_LENGTH / 100`.
 */
export const SWOOSH_LENGTH = 334.2;
const TICKS = ['M228 -262 L262 -300', 'M270 -222 L318 -240', 'M196 -296 L208 -340'] as const;

export type AccentShapes = {
  readonly swoosh: Shape;
  readonly stars: readonly { readonly at: Vec; readonly scale: number; readonly shape: Shape }[];
  readonly ticks: readonly Shape[];
};

export function accentShapes(tone: SenAccentTone): AccentShapes {
  const { mark, swoosh } = SEN_ACCENT_TONES[tone];
  return {
    swoosh: {
      kind: 'path',
      d: 'M-330 60 Q-330 250 -140 300',
      stroke: swoosh,
      strokeWidth: 44,
      strokeDasharray: SWOOSH_LENGTH,
    },
    stars: STARS.map(({ at, scale }) => ({
      at,
      scale,
      shape: {
        kind: 'path',
        d: STAR_D,
        fill: mark,
        stroke: mark,
        strokeWidth: 10,
        strokeLinejoin: 'round',
      },
    })),
    ticks: TICKS.map((d): Shape => ({ kind: 'path', d, stroke: mark, strokeWidth: 18 })),
  };
}
