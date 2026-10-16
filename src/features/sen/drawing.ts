import type { Frame } from './channels';
import type { Matrix } from './art/matrix';
import { NODES, SVG_TREE, type TreeNode } from './art/nodes';
import type { Moment } from './timeline/types';

const I: Matrix = [1, 0, 0, 1, 0, 0];

function times(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const round = (v: number) => Math.round(v * 1000) / 1000 + 0;

/**
 * What a frame puts on screen: every drawn part with its composed matrix and opacity, and the four
 * body transforms. Two frames that split a value differently across layers, such as a squint held on
 * the pose layer or on the open layer, draw the same.
 */
export function drawing(frame: Frame): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (nodes: readonly TreeNode[], m: Matrix, op: number) => {
    for (const n of nodes) {
      const p = NODES[n.node].read(frame, 1);
      const o = op * (p.opacity ?? 1);
      if (o === 0) continue;
      const here = p.matrix ? times(m, p.matrix) : m;
      if (n.shapes) out[n.node] = { opacity: round(o), matrix: here.map(round) };
      walk(n.children ?? [], here, o);
    }
  };
  walk(SVG_TREE, I, 1);
  for (const id of ['mv', 'rl', 'sq', 'sp'] as const) out[id] = NODES[id].read(frame, 1);
  out.edge = NODES.edge.read(frame, 1).opacity;
  return JSON.parse(
    JSON.stringify(out, (_k, v: unknown) => (typeof v === 'number' ? round(v) : v)),
  );
}

/** The frame a moment opens on: each track's value at 0, and its start pose everywhere else. */
export function firstFrame(m: Moment, from: Frame): Frame {
  const f: Record<string, number> = { ...from };
  for (const [ch, steps] of Object.entries(m.tracks)) if (steps?.[0].at === 0) f[ch] = steps[0].v;
  return f as Frame;
}

/** The frame a moment ends on: each track's last value, and its start pose everywhere else. */
export function lastFrame(m: Moment, from: Frame): Frame {
  const f: Record<string, number> = { ...from };
  for (const [ch, steps] of Object.entries(m.tracks)) if (steps) f[ch] = steps[steps.length - 1]!.v;
  return f as Frame;
}
