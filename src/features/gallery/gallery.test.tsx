import { act, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { toast, ToastHost } from '@/components/toast';
import { applyTheme } from '@/theme/unistyles';

import { GalleryBody, StatesScreen } from './index';
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
  expect(screen.getByTestId(`shot-${name}-${state}-system`)).toBeOnTheScreen();
});

test('a component state draws under its caption', async () => {
  await render(<GalleryBody query={{ kind: 'state', screen: 'tag', state: 'added' }} />);
  expect(screen.getByText('tag · added')).toBeOnTheScreen();
});

test('a screen state draws the real screen edge to edge, with no caption', async () => {
  await render(<GalleryBody query={{ kind: 'state', screen: 'auth', state: 'lock-timed-out' }} />);
  expect(screen.getByRole('header', { name: 'Took too long.' })).toBeOnTheScreen();
  expect(screen.queryByText('auth · lock-timed-out')).not.toBeOnTheScreen();
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

test('a drawn state carries its shot name once its theme has applied', async () => {
  applyTheme('light');
  await render(
    <GalleryBody query={{ kind: 'state', screen: 'key', state: 'lemon' }} theme="light" />,
  );
  expect(screen.getByTestId('shot-key-lemon-light')).toBeOnTheScreen();
});

test('a state still waiting for its theme carries no shot name, so a flow never captures it', async () => {
  applyTheme('light');
  await render(
    <GalleryBody query={{ kind: 'state', screen: 'key', state: 'lemon' }} theme="dark" />,
  );
  expect(screen.queryByTestId('shot-key-lemon-dark')).toBeNull();
  expect(screen.getByText('key · lemon')).toBeOnTheScreen();
});

test('the launch lab opens from its deep link and settles on Lock’s hero', async () => {
  applyTheme('light');
  await renderRouter(
    { 'dev/states': () => <StatesScreen /> },
    { initialUrl: '/dev/states?screen=motion&state=launch&theme=light' },
  );
  expect(screen.getByTestId('shot-motion-launch-light')).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(4000));

  expect(screen.queryByTestId('launch')).not.toBeOnTheScreen();
  expect(screen.getByLabelText('Sen, eyes closed while Sen is locked')).toBeOnTheScreen();
});

