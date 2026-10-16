import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { sessionStore } from '@/features/auth/session';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { playHaptic } from '@/services/haptics';
import { clearPrefs, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';

import { HistoryScreen } from './history-screen';

let mockDb: OpenDb;

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  showAmounts: async () => {
    jest.requireActual('@/features/auth/session').sessionStore.setState({ amountsHidden: false });
    return { ok: true };
  },
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');
const hidden = { includeHiddenElements: true };
const face = () =>
  (
    within(screen.getByTestId('sen-rig-month', hidden)).getByTestId('sen-lk', hidden).props
      .jestAnimatedProps.value.matrix as number[]
  ).slice(4);

/** Frame by frame, so the moment's clock and its haptic callbacks run on time. */
async function at(ms: number) {
  for (let left = ms; left > 0; left -= 10)
    await act(() => jest.advanceTimersByTime(Math.min(10, left)));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.mocked(playHaptic).mockClear();
  clearPrefs();
  sessionStore.setState({ amountsHidden: true });
  writePref('demo.datasetSize', 20);
  writePref('demo.newOnRefresh', false);
  queryClient.clear();
  mockDb = await openTestDb();
});
afterEach(() => jest.useRealTimers());

async function renderHistory() {
  await render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
}

test('showing amounts buzzes once as the check passes, and the month card’s Sen plays Reveal', async () => {
  await renderHistory();
  expect(face()).toEqual([0, 34]);

  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['reveal']]);
  await at(780);
  expect(face()).toEqual([18, -10]);
  await at(1200);

  expect(face()).toEqual([0, -6]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['reveal']]);
});

test('showing amounts just after a scroll still buzzes once, while Sen holds still', async () => {
  await renderHistory();
  await fireEvent(screen.getByTestId('history-list'), 'scrollBeginDrag');
  await fireEvent(screen.getByTestId('history-list'), 'momentumScrollEnd');
  await at(500);

  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));
  await at(780);

  expect(face()).toEqual([0, expect.closeTo(-6, 1)]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['reveal']]);
});

test('hiding amounts buzzes once from the control and plays Re-mask, ducking behind the rim', async () => {
  sessionStore.setState({ amountsHidden: false });
  await render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'Hide amounts' })).toBeOnTheScreen();
  expect(face()).toEqual([0, -6]);

  await fireEvent.press(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['hideNow']]);
  await at(310);
  expect(face()).toEqual([-28, 190]);
  await at(1100);

  expect(face()).toEqual([0, 34]);
});

test('the month card’s Sen holds its blinks while the list scrolls, and blinks again after it stops', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  sessionStore.setState({ amountsHidden: false });
  await render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'Hide amounts' })).toBeOnTheScreen();
  const eye = () =>
    (
      within(screen.getByTestId('sen-rig-month', hidden)).getByTestId('sen-elb', hidden).props
        .jestAnimatedProps.value.matrix as number[]
    )[3]!;
  const shutDuring = async (ms: number) => {
    let shut = false;
    for (let t = 0; t < ms; t += 10) {
      await at(10);
      if (eye() < 0.5) shut = true;
    }
    return shut;
  };

  await fireEvent(screen.getByTestId('history-list'), 'scrollBeginDrag');
  expect(await shutDuring(4500)).toBe(false);
  await fireEvent(screen.getByTestId('history-list'), 'momentumScrollEnd');

  expect(await shutDuring(9000)).toBe(true);
  jest.restoreAllMocks();
});

test('a History that unmounts mid-fling leaves Sen free to move on the next screen', async () => {
  const first = await render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
  await fireEvent(screen.getByTestId('history-list'), 'scrollBeginDrag');
  await fireEvent(screen.getByTestId('history-list'), 'momentumScrollBegin');
  await first.unmount();

  await renderHistory();
  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));
  await at(780);

  expect(face()).toEqual([18, -10]);
});
