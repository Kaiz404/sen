import { gapFor, PULL, readiness, stretchFor } from './pull-math';

test('the gap follows the finger at 0.6 and never passes the board maximum', () => {
  expect(gapFor(-40)).toBe(0);
  expect(gapFor(60)).toBe(36);
  expect(gapFor(120)).toBe(PULL.threshold);
  expect(gapFor(1000)).toBeLessThanOrEqual(PULL.max);
  expect(gapFor(1000)).toBeGreaterThan(PULL.max - 1);
});

test('the gap keeps growing past the threshold, a little less each pt', () => {
  const at = (drag: number) => gapFor(drag);
  expect(at(160) - at(120)).toBeGreaterThan(0);
  expect(at(200) - at(160)).toBeLessThan(at(160) - at(120));
});

test('Sen is ready at the threshold and stretches to the board scale', () => {
  expect(readiness(36)).toBe(0.5);
  expect(readiness(PULL.max)).toBe(1);
  expect(stretchFor(0)).toEqual({ sx: 1, sy: 1 });
  expect(stretchFor(1).sx).toBeCloseTo(0.9, 5);
  expect(stretchFor(1).sy).toBeCloseTo(1.18, 5);
});
