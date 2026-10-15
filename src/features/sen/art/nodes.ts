import type { TransformsStyle } from 'react-native';

import type { Channel, Frame } from '../channels';
import { MOUTH_IDS, type MouthId, type PropId } from '../poses';
import {
  CHEEKS,
  EYE_CENTER,
  EYE_HAPPY,
  EYE_OPEN,
  EYE_SHUT,
  FACE,
  MOUTH,
  PAW,
  PAW_CENTER,
  PROP,
  RIM,
  type SenTier,
  type Shape,
  TAILS,
} from './geometry';
import { type Matrix, mat } from './matrix';

/**
 * Every part of Sen as a table: the channels it reads and a pure worklet from those channels to its props
 * or style. `SenStatic` calls `read(frame, unit)` with a plain Frame. The rig captures exactly `channels`
 * as shared values in one `useAnimatedProps` or `useAnimatedStyle` per node and calls the same `read`, so
 * the two renderers can't drift and an idle node never re-runs.
 * Channels are declared, not discovered, because a Reanimated mapper subscribes to every shared value in
 * its closure (inferred). A mapper that closed over all 41 would wake on every frame. A test calls each
 * `read` with a recording Proxy and checks it reads exactly `channels`.
 */
export type NodeDef<T extends 'view' | 'svg', C extends Channel, P> = {
  readonly target: T;
  readonly channels: readonly C[];
  /** `unit` is pt per rig unit. Only `mv` uses it, because SVG nodes draw in rig units. */
  readonly read: (f: Pick<Frame, C>, unit: number) => P;
};

export type ViewTransform = { readonly transform: NonNullable<TransformsStyle['transform']> };
export type SvgProps = { readonly matrix?: Matrix; readonly opacity?: number };

function view<C extends Channel>(
  channels: readonly C[],
  read: (f: Pick<Frame, C>, unit: number) => ViewTransform,
): NodeDef<'view', C, ViewTransform> {
  return { target: 'view', channels, read };
}
function svg<C extends Channel>(
  channels: readonly C[],
  read: (f: Pick<Frame, C>) => SvgProps,
): NodeDef<'svg', C, SvgProps> {
  return { target: 'svg', channels, read };
}
function fade<C extends Channel>(ch: C): NodeDef<'svg', C, SvgProps> {
  return svg([ch], (f) => {
    'worklet';
    return { opacity: f[ch] };
  });
}
const still = svg([], () => {
  'worklet';
  return {};
});

/** Heads shows while cos θ ≥ 0 and tails otherwise. The edge pill shows only near edge-on. */
const EDGE_ON = 0.2;

export const NODES = {
  // Body, four nested Animated.Views. Pivots are static `transformOrigin` values (geometry.PIVOT).
  mv: view(['mv.x', 'mv.y'], (f, unit) => {
    'worklet';
    return { transform: [{ translateX: f['mv.x'] * unit }, { translateY: f['mv.y'] * unit }] };
  }),
  rl: view(['rl.r'], (f) => {
    'worklet';
    return { transform: [{ rotate: `${f['rl.r']}deg` }] };
  }),
  sq: view(['sq.r', 'sq.k', 'sq.sx', 'sq.sy'], (f) => {
    'worklet';
    return {
      transform: [
        { rotate: `${f['sq.r']}deg` },
        { skewX: `${f['sq.k']}deg` },
        { scaleX: f['sq.sx'] },
        { scaleY: f['sq.sy'] },
      ],
    };
  }),
  sp: view(['sp.th'], (f) => {
    'worklet';
    return { transform: [{ scaleX: Math.cos(f['sp.th']) }] };
  }),

  heads: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.cos(f['sp.th']) >= 0 ? 1 : 0 };
  }),
  tails: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.cos(f['sp.th']) < 0 ? 1 : 0 };
  }),
  /** Not in SVG_TREE: it sits outside `sp`, so the rig draws it in its own layer under `sq`. */
  edge: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.abs(Math.cos(f['sp.th'])) < EDGE_ON ? 1 : 0 };
  }),
  coin: still,

  lk: svg(['lk.x', 'lk.y'], (f) => {
    'worklet';
    return { matrix: mat(f['lk.x'], f['lk.y'], 0, 1, 1, 0, 0) };
  }),
  eyeL: svg(['eyeL.sx', 'eyeL.sy', 'eyeL.dx', 'eyeL.dy'], (f) => {
    'worklet';
    const [ox, oy] = EYE_CENTER.L;
    return { matrix: mat(f['eyeL.dx'], f['eyeL.dy'], 0, f['eyeL.sx'], f['eyeL.sy'], ox, oy) };
  }),
  eyeR: svg(['eyeR.sx', 'eyeR.sy', 'eyeR.dx', 'eyeR.dy'], (f) => {
    'worklet';
    const [ox, oy] = EYE_CENTER.R;
    return { matrix: mat(f['eyeR.dx'], f['eyeR.dy'], 0, f['eyeR.sx'], f['eyeR.sy'], ox, oy) };
  }),
  eyeLOpen: fade('eyeL.open'),
  eyeLShut: fade('eyeL.shut'),
  eyeROpen: fade('eyeR.open'),
  eyeRShut: fade('eyeR.shut'),
  eyesHappy: fade('eyes.happy'),

  mouthSmile: fade('mo.smile'),
  mouthSmall: fade('mo.small'),
  mouthGrin: fade('mo.grin'),
  mouthFrown: fade('mo.frown'),
  mouthFlat: fade('mo.flat'),
  mouthO: fade('mo.o'),
  cheeks: fade('cheeks'),

  pawL: svg(['pawL.x', 'pawL.y', 'pawL.r'], (f) => {
    'worklet';
    const [ox, oy] = PAW_CENTER.L;
    return { matrix: mat(f['pawL.x'], f['pawL.y'], f['pawL.r'], 1, 1, ox, oy) };
  }),
  pawR: svg(['pawR.x', 'pawR.y', 'pawR.r'], (f) => {
    'worklet';
    const [ox, oy] = PAW_CENTER.R;
    return { matrix: mat(f['pawR.x'], f['pawR.y'], f['pawR.r'], 1, 1, ox, oy) };
  }),

  propMagnifier: fade('prop.magnifier'),
  propPlug: fade('prop.plug'),
  propNightcap: fade('prop.nightcap'),
  /** The shades drop in on `prop.y`, so this one node reads two channels. */
  propShades: svg(['prop.shades', 'prop.y'], (f) => {
    'worklet';
    return { opacity: f['prop.shades'], matrix: mat(0, f['prop.y'], 0, 1, 1, 0, 0) };
  }),
} as const;

export type NodeId = keyof typeof NODES;
export type SvgNodeId = {
  [K in NodeId]: (typeof NODES)[K]['target'] extends 'svg' ? K : never;
}[NodeId];

export const MOUTH_NODE: Readonly<Record<MouthId, SvgNodeId>> = {
  smile: 'mouthSmile',
  small: 'mouthSmall',
  grin: 'mouthGrin',
  frown: 'mouthFrown',
  flat: 'mouthFlat',
  o: 'mouthO',
};
export const PROP_NODE: Readonly<Record<PropId, SvgNodeId>> = {
  magnifier: 'propMagnifier',
  plug: 'propPlug',
  nightcap: 'propNightcap',
  shades: 'propShades',
};

/** One group in the drawing. Children transform with their parent. */
export type TreeNode = {
  readonly node: SvgNodeId;
  /** Drawn inside the node's group after its children, as kit.py draws a held prop under the paw. */
  readonly shapes?: readonly Shape[];
  /** The group sits inside the static face clip, so the face can tuck behind the rim. */
  readonly clip?: true;
  /** Dropped at the face tier. */
  readonly full?: true;
  readonly children?: readonly TreeNode[];
};

/**
 * Sen's drawing inside `sp`, back to front, as kit.py and MAX-Library draw it. Eyes and mouths ride in
 * `lk` inside the static clip. Worn props sit above the clip and outside `lk`, so they stay put while the
 * face slides. Held props sit in `pawR`. Both renderers walk this tree.
 */
export const SVG_TREE: readonly TreeNode[] = [
  {
    node: 'heads',
    children: [
      { node: 'coin', shapes: [RIM, FACE] },
      { node: 'cheeks', shapes: CHEEKS, full: true },
      {
        node: 'lk',
        clip: true,
        children: [
          {
            node: 'eyeL',
            children: [
              { node: 'eyeLOpen', shapes: [EYE_OPEN.L] },
              { node: 'eyeLShut', shapes: [EYE_SHUT.L] },
            ],
          },
          {
            node: 'eyeR',
            children: [
              { node: 'eyeROpen', shapes: [EYE_OPEN.R] },
              { node: 'eyeRShut', shapes: [EYE_SHUT.R] },
            ],
          },
          { node: 'eyesHappy', shapes: [EYE_HAPPY.L, EYE_HAPPY.R] },
          ...MOUTH_IDS.map((m): TreeNode => ({
            node: MOUTH_NODE[m],
            shapes: [MOUTH[m]],
            full: true,
          })),
        ],
      },
      { node: 'propNightcap', shapes: PROP.nightcap },
      { node: 'propShades', shapes: PROP.shades },
      { node: 'pawL', shapes: [PAW.L], full: true },
      {
        node: 'pawR',
        shapes: [PAW.R],
        full: true,
        children: [
          { node: 'propMagnifier', shapes: PROP.magnifier },
          { node: 'propPlug', shapes: PROP.plug },
        ],
      },
    ],
  },
  { node: 'tails', shapes: TAILS },
];

function prune(nodes: readonly TreeNode[]): readonly TreeNode[] {
  return nodes
    .filter((n) => !n.full)
    .map((n) => (n.children ? { ...n, children: prune(n.children) } : n));
}

const FACE_TREE = prune(SVG_TREE);

/** The tree a tier draws. The face tier drops mouths, cheeks, paws and held props (kit.py `face_only`). */
export function treeFor(tier: SenTier): readonly TreeNode[] {
  return tier === 'full' ? SVG_TREE : FACE_TREE;
}
