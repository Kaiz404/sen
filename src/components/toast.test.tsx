import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { toast, ToastHost } from './toast';

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => toast.hide());
  jest.useRealTimers();
});

test('Undo runs the action once and dismisses the toast', async () => {
  const undo = jest.fn();
  await render(<ToastHost />);

  await act(async () => {
    toast.show({
      title: 'Deleted',
      detail: 'Lunch with Hafiz, cash · gone from this phone',
      action: { label: 'Undo', accessibilityLabel: 'Undo delete', icon: 'undo', onPress: undo },
    });
  });
  expect(screen.getByText('Lunch with Hafiz, cash · gone from this phone')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo delete' }));

  expect(undo).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Deleted')).toBeNull();
});

test('a toast leaves after 6000 ms by default', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.show({ title: 'Reference copied' });
  });

  await act(async () => jest.advanceTimersByTime(5999));
  expect(screen.getByText('Reference copied')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(1));
  expect(screen.queryByText('Reference copied')).toBeNull();
});

test('a new toast replaces the current one, and the old timer cannot hide it', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.show({ title: 'Added', ttl: 1000 });
  });
  await act(async () => jest.advanceTimersByTime(500));
  await act(async () => {
    toast.show({ title: 'Deleted' });
  });

  await act(async () => jest.advanceTimersByTime(1000));
  expect(screen.queryByText('Added')).toBeNull();
  expect(screen.getByText('Deleted')).toBeOnTheScreen();
});
