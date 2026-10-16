import { render, screen } from '@testing-library/react-native';
import { SEN_COLORS } from '@/theme/colors';

import { Sen } from '../index';

const hidden = { includeHiddenElements: true };

function expectMatrix(testID: string, expected: readonly number[]): void {
  const actual: unknown = screen.getByTestId(testID, hidden).props.transform;
  expect(Array.isArray(actual) && actual.length).toBe(6);
  expected.forEach((v, i) => expect((actual as number[])[i]).toBeCloseTo(v, 3));
}

test('masked Sen slides its face down 34 units inside the clip, with only the shut eyes drawn', async () => {
  await render(<Sen pose="masked" size={200} />);

  expect(screen.getByTestId('sen-lk', hidden)).toHaveProp('transform', [1, 0, 0, 1, 0, 34]);
  expect(screen.getByTestId('sen-elc', hidden)).toHaveProp('opacity', 1);
  expect(screen.queryByTestId('sen-elb', hidden)).toBeNull();
  expect(screen.getByTestId('sen-mo-small', hidden)).toHaveProp('opacity', 1);
  expect(screen.queryByTestId('sen-mo-smile', hidden)).toBeNull();
});

test('a worried Sen leans -4 degrees with a 3 degree counter skew, eyes and paws smaller', async () => {
  await render(<Sen pose="worried" size={120} />);

  expect(screen.getByTestId('sen-sq', hidden)).toHaveStyle({
    transformOrigin: ['51.47%', '90.88%', 0],
    transform: [{ rotate: '-4deg' }, { skewX: '3deg' }, { scaleX: 1 }, { scaleY: 1 }],
  });
  expectMatrix('sen-el', [0.85, 0, 0, 0.85, -0.8, 2.3]);
  expectMatrix('sen-pl', [0.9, 0, 0, 0.9, 55.4, -40.8]);
});

test('a shrugging Sen lifts 14 units, squashes, and turns its paws out by 20 degrees', async () => {
  await render(<Sen pose="shrug" size={300} />);

  expect(screen.getByTestId('sen-mv', hidden)).toHaveStyle({
    transform: [{ translateX: 0 }, { translateY: -7 }],
    opacity: 1,
  });
  expect(screen.getByTestId('sen-sq', hidden)).toHaveStyle({
    transform: [{ rotate: '2deg' }, { skewX: '-2deg' }, { scaleX: 0.98 }, { scaleY: 1.03 }],
  });
  expectMatrix('sen-pl', [0.9397, -0.342, 0.342, 0.9397, -128.3796, -107.0874]);
});

test('happy eyes are the open ellipses squinted to 1.15 by 0.45, even under 48 pt', async () => {
  await render(<Sen pose="happy" size={32} />);

  expectMatrix('sen-el', [1.15, 0, 0, 0.45, 10.8, -20.9]);
  expect(screen.getByTestId('sen-elb', hidden)).toHaveProp('opacity', 1);
  expect(screen.queryByTestId('sen-elc', hidden)).toBeNull();
});

test('under 48 pt Sen draws no mouth and no paws', async () => {
  await render(<Sen pose="happy" size={32} />);

  expect(screen.queryByTestId('sen-mo-grin', hidden)).toBeNull();
  expect(screen.queryByTestId('sen-pl', hidden)).toBeNull();
});

test('from 48 pt Sen draws its mouth and paws', async () => {
  await render(<Sen pose="happy" size={48} />);

  expect(screen.getByTestId('sen-mo-grin', hidden)).toHaveProp('opacity', 1);
  expectMatrix('sen-pl', [1, 0, 0, 1, -128, -180]);
});

test('cool Sen wears its shades on the face group, inside the clip', async () => {
  await render(<Sen pose="cool" size={84} />);

  const shades = screen.getByTestId('sen-shades', hidden);
  expect(shades).toHaveProp('opacity', 1);
  expect(screen.getByTestId('sen-lk', hidden)).toContainElement(shades);
});

test('a labelled Sen is one image to a screen reader', async () => {
  await render(<Sen pose="idle" size={84} label="Sen, smiling" />);
  expect(screen.getByRole('image', { name: 'Sen, smiling' })).toBeOnTheScreen();
});

test('an unlabelled Sen is decoration, hidden from screen readers', async () => {
  await render(<Sen pose="idle" size={84} />);
  expect(screen.queryByRole('image')).toBeNull();
  expect(screen.queryByTestId('sen-lk')).toBeNull();
  expect(screen.getByTestId('sen-lk', hidden)).toBeTruthy();
});

test('the coin back is the bunga flower: five deep mint petals, a lemon eye, a thin ring and no numeral', async () => {
  await render(<Sen id="test" pose="idle" size={200} />);

  const back = screen.getByTestId('sen-tl', hidden);
  const kids = back.children as unknown as { type: string; props: Record<string, unknown> }[];
  const paths = kids.filter((k) => k.type === 'Path');
  expect(paths).toHaveLength(5);
  paths.forEach((p) => expect(p.props).toHaveProperty('fill', SEN_COLORS.feature));
  expect(new Set(paths.map((p) => p.props.d)).size).toBe(5);
  expect(paths[0]?.props.d).toBe('M-26.2 -77.4A46.2 68.2 0 0 1 66.2 -77.4A46.2 68.2 0 0 1 -26.2 -77.4Z');

  const circles = kids.filter((k) => k.type === 'Circle');
  expect(circles.map((c) => c.props.r)).toEqual([262, 222, 176, 28.6, 12.1]);
  expect(kids.some((k) => k.type !== 'Path' && k.type !== 'Circle')).toBe(false);
});
