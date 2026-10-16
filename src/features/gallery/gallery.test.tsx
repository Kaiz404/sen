import { act, render, screen } from '@testing-library/react-native';

import { toast, ToastHost } from '@/components/toast';

import { GalleryBody } from './index';
import { SCREENS } from './registry';

const states = Object.entries(SCREENS).flatMap(([name, byState]) =>
  Object.keys(byState).map((state) => [name, state] as const),
);

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => toast.hide());
  jest.useRealTimers();
});

test.each(states)('%s · %s draws from fixtures alone', async (name, state) => {
  await render(<GalleryBody query={{ kind: 'state', screen: name, state }} />);
  expect(screen.getByText(`${name} · ${state}`)).toBeOnTheScreen();
});

test('the masked slip state hides every amount', async () => {
  await render(<GalleryBody query={{ kind: 'state', screen: 'receipt-slip', state: 'masked' }} />);
  expect(screen.getAllByLabelText('Amount hidden')).toHaveLength(5);
  expect(screen.queryByText(/RM.*\d/)).toBeNull();
});

test('a toast state shows its toast through the host', async () => {
  await render(
    <>
      <GalleryBody query={{ kind: 'state', screen: 'toast', state: 'undo' }} />
      <ToastHost />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Undo delete' })).toBeOnTheScreen();
});

test('a pose query draws one labelled Sen', async () => {
  await render(<GalleryBody query={{ kind: 'pose', pose: 'worried', size: 72 }} />);
  expect(screen.getByLabelText('Sen, worried')).toBeOnTheScreen();
});

test('an unknown query says why', async () => {
  await render(<GalleryBody query={{ kind: 'unknown', reason: 'No screen "history".' }} />);
  expect(screen.getByText('No screen "history".')).toBeOnTheScreen();
});

test('a drawn state carries its shot name, so the flow can wait for the right screen', async () => {
  await render(
    <GalleryBody query={{ kind: 'state', screen: 'key', state: 'lemon' }} theme="dark" />,
  );
  expect(screen.getByTestId('shot-key-lemon-dark')).toBeOnTheScreen();
});
