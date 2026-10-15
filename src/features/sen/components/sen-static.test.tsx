import { render, screen } from '@testing-library/react-native';

import { Sen } from '../index';

test('masked Sen slides its face down 34 units inside the clip, with only the shut eyes drawn', async () => {
  await render(<Sen pose="masked" size={200} />);

  expect(screen.getByTestId('sen-lk', { includeHiddenElements: true })).toHaveProp(
    'transform',
    [1, 0, 0, 1, 0, 34],
  );
  expect(screen.getByTestId('sen-eyeLShut', { includeHiddenElements: true })).toHaveProp(
    'opacity',
    1,
  );
  expect(screen.queryByTestId('sen-eyeLOpen', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId('sen-mouthSmall', { includeHiddenElements: true })).toBeTruthy();
});

test('a worried Sen leans -4 degrees about the contact point', async () => {
  await render(<Sen pose="worried" size={120} />);

  expect(screen.getByTestId('sen-sq', { includeHiddenElements: true })).toHaveStyle({
    transformOrigin: '51.47% 90.88%',
    transform: [{ rotate: '-4deg' }, { skewX: '0deg' }, { scaleX: 1 }, { scaleY: 1 }],
  });
});

test('under 48 pt Sen draws no mouth and no paws', async () => {
  await render(<Sen pose="happy" size={32} />);

  expect(screen.getByTestId('sen-eyesHappy', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('sen-mouthGrin', { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId('sen-pawL', { includeHiddenElements: true })).toBeNull();
});

test('a labelled Sen is one image to a screen reader', async () => {
  await render(<Sen pose="idle" size={84} label="Sen, smiling" />);
  expect(screen.getByRole('image', { name: 'Sen, smiling' })).toBeOnTheScreen();
});

test('an unlabelled Sen is decoration, hidden from screen readers', async () => {
  await render(<Sen pose="idle" size={84} />);
  expect(screen.queryByRole('image')).toBeNull();
  expect(screen.queryByTestId('sen-lk')).toBeNull();
  expect(screen.getByTestId('sen-lk', { includeHiddenElements: true })).toBeTruthy();
});
