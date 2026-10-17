import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';

import { toast, ToastHost } from '@/components/toast';

import { AddKey, keyCoversContent } from './add-key';

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => toast.hide());
  jest.useRealTimers();
});

const dock = () => screen.getByTestId('add-key');

test('it is an icon-only key named "Add a transaction" that opens Add', async () => {
  const onPress = jest.fn();
  await render(<AddKey onPress={onPress} />);

  expect(screen.queryByText('Add')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Add a transaction' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('it rises 92 pt clear of a toast, and comes back down when the toast leaves', async () => {
  await render(
    <>
      <AddKey onPress={() => {}} />
      <ToastHost />
    </>,
  );
  expect(dock()).toHaveStyle({ transform: [{ translateY: 0 }] });

  await act(async () => {
    toast.show({ title: 'Added', detail: 'Lunch with Hafiz, cash · stored encrypted' });
  });
  expect(dock()).toHaveStyle({ transform: [{ translateY: -92 }] });

  await act(async () => toast.hide());
  expect(dock()).toHaveStyle({ transform: [{ translateY: 0 }] });
});

test('it gets out of the way of the search keyboard and returns with it gone', async () => {
  await render(<AddKey onPress={() => {}} />);

  await act(async () => DeviceEventEmitter.emit('keyboardDidShow', {}));
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();

  await act(async () => DeviceEventEmitter.emit('keyboardDidHide', {}));
  expect(screen.getByRole('button', { name: 'Add a transaction' })).toBeOnTheScreen();
});

test('it floats 16 above the gesture bar', async () => {
  await render(<AddKey onPress={jest.fn()} />);
  expect(dock()).toHaveStyle({ bottom: 34 + 16 });
});

test('it covers content under its resting place, or under its lifted place while a toast is up', () => {
  const key = { y: 620, height: 64 };
  expect(keyCoversContent(key, false, { y: 600, height: 50 }, 0)).toBe(true);
  expect(keyCoversContent(key, false, { y: 400, height: 50 }, 0)).toBe(false);
  expect(keyCoversContent(key, false, { y: 560, height: 50 }, 0)).toBe(false);
  expect(keyCoversContent(key, true, { y: 560, height: 50 }, 0)).toBe(true);
  expect(keyCoversContent(key, true, { y: 560, height: 50 }, 100)).toBe(false);
});
