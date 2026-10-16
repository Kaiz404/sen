import { slice } from '../board';
import { BOARDS } from '../board.gen';
import { edgeSpin, eulerSteps } from './generators';

const peaks = (steps: readonly { v: number }[]) =>
  steps.filter((_, i) => i % 2 === 1).map((s) => s.v);

test('the wobble swings 11, then 0.72 of the last swing the other way', () => {
  const r = eulerSteps({ at: 0 })['sq.r'];

  expect(
    peaks(r)
      .slice(0, 4)
      .map((v) => Number(v.toFixed(2))),
  ).toEqual([11, -7.92, 5.7, -4.11]);
  expect(r.map((s) => s.at).slice(0, 7)).toEqual([0, 100, 200, 280, 360, 424, 488]);
});

test("eulerSteps draws MAX-Library's .L-wob tilt, swing for swing", () => {
  const board = slice(BOARDS['MAX-Library']['.L-wob']['sq.r'], { from: 300, to: 1193 });
  const ours = eulerSteps({ at: 0 })['sq.r'];

  expect(ours.map((s) => s.at)).toEqual(board.map((s) => s.at));
  ours.forEach((s, i) => expect(s.v).toBeCloseTo(board[i]!.v, 3));
  const eases = (steps: readonly object[]) =>
    steps.slice(1).map((s) => ('ease' in s ? s.ease : null));
  expect(eases(ours)).toEqual(eases(board));
});

test("eulerSteps narrows the coin as it tilts and ends on the board's clack", () => {
  const board = slice(BOARDS['MAX-Library']['.L-wob']['sq.sx'], { from: 300, to: 1323 });
  const ours = eulerSteps({ at: 0 })['sq.sx'];

  expect(ours[1]).toEqual({ at: 100, v: expect.closeTo(0.94, 6), ease: 'outS' });
  expect(ours.map((s) => s.at)).toEqual(board.map((s) => s.at));
  ours.forEach((s, i) => expect(s.v).toBeCloseTo(board[i]!.v, 4));
});

test('the refresh landing wobbles 6 swings from 8 degrees, as on .M-ref.ph-land', () => {
  const board = slice(BOARDS['MAX-Moments']['.M-ref.ph-land']['sq.r'], { from: 330, to: 1031 });
  const ours = eulerSteps({ at: 0, a0: 8, swings: 6, half: 95 })['sq.r'];

  expect(ours.map((s) => s.at)).toEqual(board.map((s) => s.at));
  ours.forEach((s, i) => expect(s.v).toBeCloseTo(board[i]!.v, 3));
});

test('the edge spin reaches edge-on in 240 ms, then turns once every 600 ms', () => {
  expect(edgeSpin()).toEqual({
    intro: [
      { at: 0, v: 0 },
      { at: 240, v: 1.5707963267948966, ease: 'inS' },
    ],
    lap: [
      { at: 0, v: 1.5707963267948966 },
      { at: 600, v: 7.853981633974483 },
    ],
  });
});
