import { CHANNELS, type Channel, type Frame, REST } from '../channels';
import { mat } from './matrix';
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

test('the face tier drops mouths, cheeks, paws and held props, and keeps worn props', () => {
  expect(ids(treeFor('face'))).toEqual([
    'heads',
    'coin',
    'lk',
    'eyeL',
    'eyeLOpen',
    'eyeLShut',
    'eyeR',
    'eyeROpen',
    'eyeRShut',
    'eyesHappy',
    'propNightcap',
    'propShades',
    'tails',
  ]);
});

test('the masked face slides down 34 units', () => {
  expect(NODES.lk.read({ 'lk.x': 0, 'lk.y': 34 }, 1)).toEqual({ matrix: [1, 0, 0, 1, 0, 34] });
});

test('mv moves in points, everything else in rig units', () => {
  expect(NODES.mv.read({ 'mv.x': 60, 'mv.y': -30 }, 0.5)).toEqual({
    transform: [{ translateX: 30 }, { translateY: -15 }],
  });
});

test('heads, tails and the edge pill follow the spin angle', () => {
  const at = (th: number) =>
    (['heads', 'tails', 'edge'] as const).map((id) => NODES[id].read({ 'sp.th': th }, 1).opacity);
  expect(at(0)).toEqual([1, 0, 0]);
  expect(at(Math.PI / 2 - 0.1)).toEqual([1, 0, 1]);
  expect(at(Math.PI)).toEqual([0, 1, 0]);
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
