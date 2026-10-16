import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { FrozenMotion } from '@/motion/policy';

import { senTier } from '../art/geometry';
import { type TreeNode, treeFor } from '../art/nodes';
import { Sen } from '../index';
import { POSE_IDS, type PoseId } from '../poses';
import { SenStatic } from './sen-static';

const hidden = { includeHiddenElements: true };
type Drawn = { opacity?: number; matrix?: readonly number[] };

function staticDrawing(tree: readonly TreeNode[]): Record<string, Drawn> {
  const out: Record<string, Drawn> = {};
  const walk = (nodes: readonly TreeNode[]) =>
    nodes.forEach((n) => {
      const el = screen.queryByTestId(`sen-${n.node}`, hidden);
      if (!el) return;
      out[n.node] = { opacity: el.props.opacity, matrix: el.props.transform };
      walk(n.children ?? []);
    });
  walk(tree);
  return out;
}

function rigDrawing(tree: readonly TreeNode[]): Record<string, Drawn> {
  const out: Record<string, Drawn> = {};
  const walk = (nodes: readonly TreeNode[]) =>
    nodes.forEach((n) => {
      const p: Drawn = screen.getByTestId(`sen-${n.node}`, hidden).props.jestAnimatedProps.value;
      if (p.opacity === 0) return;
      out[n.node] = { opacity: p.opacity, matrix: p.matrix };
      walk(n.children ?? []);
    });
  walk(tree);
  return out;
}

const BODY = ['sen-mv', 'sen-rl', 'sen-sq', 'sen-sp'] as const;
const staticBody = () =>
  BODY.map((id) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style).transform);
const rigBody = () => BODY.map((id) => getAnimatedStyle(screen.getByTestId(id, hidden)).transform);

function expectSame(actual: Record<string, Drawn>, expected: Record<string, Drawn>) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const [node, d] of Object.entries(expected)) {
    const a = actual[node]!;
    expect([node, a.opacity]).toEqual([node, d.opacity]);
    d.matrix?.forEach((v, i) =>
      expect([node, i, a.matrix?.[i]]).toEqual([node, i, expect.closeTo(v, 3)]),
    );
  }
}

async function drawnStatic(pose: PoseId, size: number) {
  const view = await render(<SenStatic pose={pose} size={size} />);
  const drawing = { svg: staticDrawing(treeFor(senTier(size))), body: staticBody() };
  await view.unmount();
  return drawing;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test.each(POSE_IDS)('a rig resting in %s draws exactly what SenStatic draws', async (pose) => {
  const expected = await drawnStatic(pose, 200);

  await render(<Sen id="test" pose={pose} size={200} />);

  expectSame(rigDrawing(treeFor('full')), expected.svg);
  expect(rigBody()).toEqual(expected.body);
});

test('a rig eases from masked into worried and then draws what SenStatic draws', async () => {
  const expected = await drawnStatic('worried', 120);
  const view = await render(<Sen id="test" pose="masked" size={120} />);

  await view.rerender(<Sen id="test" pose="worried" size={120} />);
  await act(() => jest.advanceTimersByTime(100));
  expect(rigDrawing(treeFor('full'))).not.toEqual(expected.svg);
  await act(() => jest.advanceTimersByTime(2000));

  expectSame(rigDrawing(treeFor('full')), expected.svg);
});

test('under 48 pt the rig draws the face tier, as SenStatic does', async () => {
  const expected = await drawnStatic('happy', 32);

  await render(<Sen id="test" pose="happy" size={32} />);

  expectSame(rigDrawing(treeFor('face')), expected.svg);
  expect(screen.queryByTestId('sen-pl', hidden)).toBeNull();
});

test('without an id Sen stays the static drawing, with no animated props', async () => {
  await render(<Sen pose="idle" size={84} />);

  expect(screen.getByTestId('sen-lk', hidden).props.jestAnimatedProps).toBeUndefined();
});

test('a Sen under FrozenMotion schedules no ambient beats', async () => {
  const idle = <Sen id="ambient" pose="idle" size={200} />;
  const timersFrom = async (tree: ReactElement) => {
    const before = jest.getTimerCount();
    await render(tree);
    const added = jest.getTimerCount() - before;
    await screen.unmount();
    return added;
  };

  const live = await timersFrom(idle);
  const frozen = await timersFrom(<FrozenMotion>{idle}</FrozenMotion>);

  expect(live - frozen).toBe(1);
});
