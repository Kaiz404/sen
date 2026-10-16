import { accentShapes, PIVOT, SWOOSH_LENGTH, transformOrigin } from './geometry';

const processTransformOrigin: (origin: unknown) => unknown = jest.requireActual(
  'react-native/Libraries/StyleSheet/processTransformOrigin',
).default;

test("every pivot survives React Native's own transform-origin parser unchanged", () => {
  expect(processTransformOrigin(transformOrigin(PIVOT.contact))).toEqual(['51.47%', '90.88%', 0]);
  for (const pivot of Object.values(PIVOT)) {
    const origin = transformOrigin(pivot);
    expect(processTransformOrigin(origin)).toEqual(origin);
  }
});

test('SWOOSH_LENGTH is the arc length of the swoosh path, so a dash offset of it hides the stroke', () => {
  const swoosh = accentShapes('onPastel').swoosh;
  const nums = swoosh.kind === 'path' ? swoosh.d.match(/-?\d+/g)?.map(Number) : undefined;
  const [x0 = 0, y0 = 0, cx = 0, cy = 0, x1 = 0, y1 = 0] = nums ?? [];
  let length = 0;
  let [px, py] = [x0, y0];
  for (let i = 1; i <= 10000; i++) {
    const t = i / 10000;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
    length += Math.hypot(x - px, y - py);
    [px, py] = [x, y];
  }
  expect(nums).toEqual([-330, 60, -330, 250, -140, 300]);
  expect(SWOOSH_LENGTH).toBeCloseTo(length, 1);
  expect(swoosh.strokeDasharray).toBe(SWOOSH_LENGTH);
});
