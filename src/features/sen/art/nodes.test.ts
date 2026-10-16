import { CHANNELS, type Channel, type Frame, REST } from '../channels';
import { poseFrame } from '../poses';
import { type Matrix, mat } from './matrix';
import { NODES, type NodeId, SVG_TREE, type TreeNode, treeFor } from './nodes';

function recording(): { frame: Frame; read: Set<string> } {
  const read = new Set<string>();
  const frame = new Proxy(REST, {
    get(target, key) {
      if (typeof key === 'string') read.add(key);
      return Reflect.get(target, key);
    },
  });
  return { frame, read };
}

test.each(Object.keys(NODES) as NodeId[])('%s reads exactly the channels it declares', (id) => {
  const node = NODES[id];
  const { frame, read } = recording();

  node.read(frame, 1);

  expect([...read].sort()).toEqual([...(node.channels as readonly Channel[])].sort());
});

test('every declared channel exists', () => {
  const all = new Set<string>(CHANNELS);
  const declared = Object.values(NODES).flatMap((n) => [...(n.channels as readonly Channel[])]);
  expect(declared.filter((ch) => !all.has(ch))).toEqual([]);
});

const ids = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => [n.node, ...ids(n.children ?? [])]);

test('every SVG node but the edge pill is drawn exactly once', () => {
  const svgNodes = (Object.keys(NODES) as NodeId[]).filter(
    (id) => NODES[id].target === 'svg' && id !== 'edge',
  );
  expect(ids(SVG_TREE).sort()).toEqual(svgNodes.sort());
});

test('the face tier drops cheeks, mouths, paws and held props, and keeps eyes and worn props', () => {
  expect(ids(treeFor('face'))).toEqual([
    'hd',
    'coin',
    'lk',
    'el',
    'elb',
    'elc',
    'er',
    'erb',
    'erc',
    'shades',
    'cap',
    'tl',
  ]);
});

test('held props ride the right paw secondary layer, behind the paw', () => {
  const pr = SVG_TREE[0]?.children?.find((n) => n.node === 'pr');
  expect(ids(pr ? [pr] : [])).toEqual(['pr', 'prf', 'prop-magnifier', 'prop-plug']);
});

test('the masked face slides down 34 units', () => {
  expect(NODES.lk.read({ 'lk.x': 0, 'lk.y': 34 }, 1)).toEqual({ matrix: [1, 0, 0, 1, 0, 34] });
});

test('mv moves in points, everything else in rig units, and fades the whole rig', () => {
  expect(NODES.mv.read({ 'mv.x': 60, 'mv.y': -30, 'mv.op': 0.4 }, 0.5)).toEqual({
    transform: [{ translateX: 30 }, { translateY: -15 }],
    opacity: 0.4,
  });
});

test('heads, tails and the edge pill follow the spin angle', () => {
  const at = (th: number) =>
    (['hd', 'tl', 'edge'] as const).map((id) => NODES[id].read({ 'sp.th': th }, 1).opacity);
  expect(at(0)).toEqual([1, 0, 0]);
  expect(at(Math.PI / 2 - 0.1)).toEqual([1, 0, 1]);
  expect(at(Math.PI)).toEqual([0, 1, 0]);
});

test('the edge pill shows only while |cos θ| is under 0.12', () => {
  const edge = (cos: number) => NODES.edge.read({ 'sp.th': Math.acos(cos) }, 1).opacity;
  expect([edge(0.13), edge(0.11), edge(-0.11), edge(-0.13)]).toEqual([0, 1, 1, 0]);
});

test('sp never scales below 0.02 edge-on, and keeps the sign of cos θ', () => {
  const scaleX = (th: number) => NODES.sp.read({ 'sp.th': th }, 1).transform;
  expect(scaleX(Math.PI / 2)).toEqual([{ scaleX: 0.02 }]);
  expect(scaleX(Math.PI / 2 + 0.001)).toEqual([{ scaleX: -0.02 }]);
  expect(scaleX(Math.PI)).toEqual([{ scaleX: -1 }]);
});

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const apply = ([a, b, c, d, e, f]: Matrix, [x, y]: readonly [number, number]) =>
  [a * x + c * y + e, b * x + d * y + f] as const;

function leftEyeSpan(frame: Frame): readonly number[] {
  const pose = NODES.el.read(frame, 1).matrix ?? IDENTITY;
  const open = NODES.elb.read(frame, 1).matrix ?? IDENTITY;
  return [-58, -18].map((y) => apply(pose, apply(open, [-72, y]))[1]);
}

test('a blink over a held squint keeps the squint, because the pose and open layers compose', () => {
  const squint = poseFrame('squint');
  const [top, bottom] = leftEyeSpan(squint);
  expect(top).toBeCloseTo(-45);
  expect(bottom).toBeCloseTo(-31);

  const [blinkTop, blinkBottom] = leftEyeSpan({ ...squint, 'elb.sy': 0.1 });
  expect(blinkTop).toBeCloseTo(-38.7);
  expect(blinkBottom).toBeCloseTo(-37.3);
});

describe('mat', () => {
  test('a pure translate', () => {
    expect(mat(-26, 0, 0, 1, 1, 0, 0)).toEqual([1, 0, 0, 1, -26, 0]);
  });

  test('a scale about the left eye keeps the eye centre fixed', () => {
    const m = mat(0, 0, 0, 1.15, 0.35, -72, -38);
    [1.15, 0, 0, 0.35, 10.8, -24.7].forEach((v, i) => expect(m[i]).toBeCloseTo(v, 10));
  });

  test('a 90 degree turn about the contact point', () => {
    const m = mat(0, 0, 90, 1, 1, 10, 278);
    [0, 1, -1, 0, 288, 268].forEach((v, i) => expect(m[i]).toBeCloseTo(v, 10));
  });
});
