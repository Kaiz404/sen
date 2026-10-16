import { fireEvent, render, screen } from '@testing-library/react-native';

import { Key } from './key';

test('pressIn drops the face 4 px onto the shadow plate, and pressOut lifts it', async () => {
  await render(<Key label="Reveal for 60 seconds" tone="lemon" onPress={() => {}} />);
  const key = screen.getByRole('button', { name: 'Reveal for 60 seconds' });
  const face = screen.getByTestId('key-face');
  expect(face).toHaveStyle({ transform: [{ translateY: 0 }] });

  await fireEvent(key, 'pressIn');
  expect(face).toHaveStyle({ transform: [{ translateY: 4 }] });

  await fireEvent(key, 'pressOut');
  expect(face).toHaveStyle({ transform: [{ translateY: 0 }] });
});

test('a press calls onPress once', async () => {
  const onPress = jest.fn();
  await render(<Key icon="lock" accessibilityLabel="Lock Sen now" onPress={onPress} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Lock Sen now' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a disabled key tells screen readers it is disabled', async () => {
  await render(<Key label="Checking it's you" tone="lemon" disabled onPress={() => {}} />);
  expect(screen.getByRole('button', { name: "Checking it's you" })).toBeDisabled();
});
