import type { TransformsStyle } from 'react-native';

import { type Channel, type Frame, HELD_PROP_IDS, MOUTH_IDS } from '../channels';
import {
  CHEEKS,
  EYE_OPEN,
  EYE_SHUT,
  FACE,
  MOUTH,
  ORIGIN,
  PAW,
  PROP,
  RIM,
  type SenTier,
  type Shape,
  TAILS,
} from './geometry';
import { type Matrix, mat } from './matrix';

/**
 * Channels are declared, not discovered, because a Reanimated mapper subscribes to every shared value in
 * its closure. A mapper that closed over every channel would wake on every frame.
 */
export type NodeDef<T extends 'view' | 'svg', C extends Channel, P> = {
  readonly target: T;
  readonly channels: readonly C[];
  readonly read: (f: Pick<Frame, C>, unit: number) => P;
};

export type BodyStyle = {
  readonly transform: NonNullable<TransformsStyle['transform']>;
  readonly opacity?: number;
};
export type SvgProps = { readonly matrix?: Matrix; readonly opacity?: number };

function view<C extends Channel>(
  channels: readonly C[],
  read: (f: Pick<Frame, C>, unit: number) => BodyStyle,
): NodeDef<'view', C, BodyStyle> {
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

/** An eye's pose layer: offset and scale about the eye box. */
function eyePose(n: 'el' | 'er') {
  const ch = [`${n}.x`, `${n}.y`, `${n}.sx`, `${n}.sy`] as const;
  const [ox, oy] = ORIGIN[n];
  return svg(ch, (f) => {
    'worklet';
    return { matrix: mat(f[ch[0]], f[ch[1]], 0, f[ch[2]], f[ch[3]], ox, oy) };
  });
}

/** An eye's open (`b`) or shut (`c`) layer: a scale and a crossfade. */
function eyeLayer(n: 'elb' | 'elc' | 'erb' | 'erc') {
  const ch = [`${n}.sx`, `${n}.sy`, `${n}.op`] as const;
  const [ox, oy] = ORIGIN[n];
  return svg(ch, (f) => {
    'worklet';
    return { opacity: f[ch[2]], matrix: mat(0, 0, 0, f[ch[0]], f[ch[1]], ox, oy) };
  });
}

/** A paw layer: `pl` and `pr` hold the pose, `plf` and `prf` carry the secondary motion. */
function pawLayer(n: 'pl' | 'plf' | 'pr' | 'prf') {
  const ch = [`${n}.x`, `${n}.y`, `${n}.r`, `${n}.s`] as const;
  const [ox, oy] = ORIGIN[n];
  return svg(ch, (f) => {
    'worklet';
    return { matrix: mat(f[ch[0]], f[ch[1]], f[ch[2]], f[ch[3]], f[ch[3]], ox, oy) };
  });
}

/** A worn prop: it moves and tilts about its own centre and fades in. */
function worn(n: 'cap' | 'shades') {
  const ch = [`${n}.x`, `${n}.y`, `${n}.r`, `${n}.op`] as const;
  const [ox, oy] = ORIGIN[n];
  return svg(ch, (f) => {
    'worklet';
    return { opacity: f[ch[3]], matrix: mat(f[ch[0]], f[ch[1]], f[ch[2]], 1, 1, ox, oy) };
  });
}

/** MAX-Spec: the edge pill shows while `|cos θ| < 0.12`, and `sp` never scales below 0.02. */
const EDGE_ON = 0.12;
const EDGE_FLOOR = 0.02;

export const NODES = {
  mv: view(['mv.x', 'mv.y', 'mv.op'], (f, unit) => {
    'worklet';
    return {
      transform: [{ translateX: f['mv.x'] * unit }, { translateY: f['mv.y'] * unit }],
      opacity: f['mv.op'],
    };
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
    const cos = Math.cos(f['sp.th']);
    const scale = Math.max(Math.abs(cos), EDGE_FLOOR);
    return { transform: [{ scaleX: cos < 0 ? -scale : scale }] };
  }),

  hd: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.cos(f['sp.th']) >= 0 ? 1 : 0 };
  }),
  tl: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.cos(f['sp.th']) < 0 ? 1 : 0 };
  }),
  edge: svg(['sp.th'], (f) => {
    'worklet';
    return { opacity: Math.abs(Math.cos(f['sp.th'])) < EDGE_ON ? 1 : 0 };
  }),
  coin: still,
  ck: fade('ck.op'),

  lk: svg(['lk.x', 'lk.y'], (f) => {
    'worklet';
    return { matrix: mat(f['lk.x'], f['lk.y'], 0, 1, 1, 0, 0) };
  }),
  el: eyePose('el'),
  elb: eyeLayer('elb'),
  elc: eyeLayer('elc'),
  er: eyePose('er'),
  erb: eyeLayer('erb'),
  erc: eyeLayer('erc'),

  mo: svg(['mo.sx', 'mo.sy'], (f) => {
    'worklet';
    const [ox, oy] = ORIGIN.mo;
    return { matrix: mat(0, 0, 0, f['mo.sx'], f['mo.sy'], ox, oy) };
  }),
  'mo-smile': fade('mo.smile'),
  'mo-small': fade('mo.small'),
  'mo-grin': fade('mo.grin'),
  'mo-frown': fade('mo.frown'),
  'mo-flat': fade('mo.flat'),
  'mo-o': fade('mo.o'),

  shades: worn('shades'),
  cap: worn('cap'),

  pl: pawLayer('pl'),
  plf: pawLayer('plf'),
  pr: pawLayer('pr'),
  prf: pawLayer('prf'),
  'prop-magnifier': fade('prop.magnifier'),
  'prop-plug': fade('prop.plug'),
} as const;

export type NodeId = keyof typeof NODES;
export type SvgNodeId = {
  [K in NodeId]: (typeof NODES)[K]['target'] extends 'svg' ? K : never;
}[NodeId];

export type TreeNode = {
  readonly node: SvgNodeId;
  readonly shapes?: readonly Shape[];
  readonly clip?: true;
  readonly full?: true;
  readonly children?: readonly TreeNode[];
};

/** The coin's SVG, inside `sp`, in the boards' nesting and draw order. */
export const SVG_TREE: readonly TreeNode[] = [
  {
    node: 'hd',
    children: [
      { node: 'coin', shapes: [RIM, FACE] },
      { node: 'ck', shapes: CHEEKS, full: true },
      {
        node: 'lk',
        clip: true,
        children: [
          {
            node: 'el',
            children: [
              { node: 'elb', shapes: [EYE_OPEN.L] },
              { node: 'elc', shapes: [EYE_SHUT.L] },
            ],
          },
          {
            node: 'er',
            children: [
              { node: 'erb', shapes: [EYE_OPEN.R] },
              { node: 'erc', shapes: [EYE_SHUT.R] },
            ],
          },
          {
            node: 'mo',
            full: true,
            children: MOUTH_IDS.map((m): TreeNode => ({ node: `mo-${m}`, shapes: [MOUTH[m]] })),
          },
          { node: 'shades', shapes: PROP.shades },
        ],
      },
      { node: 'cap', shapes: PROP.nightcap },
      { node: 'pl', full: true, children: [{ node: 'plf', shapes: [PAW.L] }] },
      {
        node: 'pr',
        full: true,
        children: [
          {
            node: 'prf',
            shapes: [PAW.R],
            children: HELD_PROP_IDS.map((p): TreeNode => ({ node: `prop-${p}`, shapes: PROP[p] })),
          },
        ],
      },
    ],
  },
  { node: 'tl', shapes: TAILS },
];

function prune(nodes: readonly TreeNode[]): readonly TreeNode[] {
  return nodes
    .filter((n) => !n.full)
    .map((n) => (n.children ? { ...n, children: prune(n.children) } : n));
}

const FACE_TREE = prune(SVG_TREE);

export function treeFor(tier: SenTier): readonly TreeNode[] {
  return tier === 'full' ? SVG_TREE : FACE_TREE;
}
