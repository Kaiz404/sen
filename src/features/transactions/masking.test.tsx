import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { moneySpoken, signed } from '@/models/money';
import { sessionStore } from '@/features/auth/session';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, writePref } from '@/services/prefs';
import { QK, queryClient } from '@/services/query-client';
import { generateBankRows } from '@/services/seed';

import { HistoryScreen } from './history-screen';

let mockDb: OpenDb;
const mockData: unknown[] = [];

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  showAmounts: async () => {
    jest.requireActual('@/features/auth/session').sessionStore.setState({ amountsHidden: false });
    return { ok: true };
  },
}));
jest.mock('@shopify/flash-list', () => {
  const actual = jest.requireActual('@shopify/flash-list');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    FlashList: (props: { data: unknown }) => {
      mockData.push(props.data);
      return createElement(actual.FlashList, props);
    },
  };
});

const NOW = new Date('2026-10-15T06:00:00.000Z');
const SEEDED = generateBankRows(20, NOW.toISOString() as never);

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
  sessionStore.setState({ amountsHidden: true });
  writePref('demo.datasetSize', 20);
  writePref('demo.newOnRefresh', false);
  queryClient.clear();
  mockDb = await openTestDb();
  mockData.length = 0;
});
afterEach(() => jest.useRealTimers());

const renderHistory = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );

type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };

/** Every string a user or a screen reader gets: text and accessibility labels. */
function tree(): string {
  const out: string[] = [];
  const walk = (node: Node | string) => {
    if (typeof node === 'string') return void out.push(node);
    const label = node.props.accessibilityLabel;
    if (typeof label === 'string') out.push(label);
    node.children?.forEach(walk);
  };
  const root = screen.toJSON() as Node | Node[] | null;
  (Array.isArray(root) ? root : root === null ? [] : [root]).forEach(walk);
  return out.join('|');
}
const cache = () =>
  JSON.stringify(
    queryClient
      .getQueryCache()
      .getAll()
      .map((q) => [q.queryKey, q.state.data]),
    (_k, v) => (v instanceof Map ? [...v] : v),
  );

test('while hidden no seeded amount is in the tree or the cache, totals included', async () => {
  await renderHistory();
  expect(await screen.findByText('Grab ride to KL Sentral')).toBeOnTheScreen();
  expect(await screen.findByLabelText('Month summary, amounts hidden')).toBeOnTheScreen();

  expect(tree()).not.toMatch(/\d\.\d\d|ringgit/);
  expect(cache()).not.toMatch(/amountMinor|"minor"|netMinor/);
  expect(queryClient.getQueriesData({ queryKey: QK.revealed }).map(([, data]) => data)).toEqual(
    queryClient.getQueriesData({ queryKey: QK.revealed }).map(() => undefined),
  );
  for (const row of SEEDED)
    expect(tree()).not.toContain(moneySpoken(signed(row.amountMinor as never, row.type), 'never'));
});

test('the month card says how long a reveal lasts', async () => {
  await renderHistory();

  expect(
    await screen.findByText('Asks for fingerprint first. Stays shown until you hide it or Sen locks.'),
  ).toBeOnTheScreen();
});

test('show and hide keep the list data, roll amounts in and take them out again', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  const listData = mockData.at(-1);

  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));

  expect(await screen.findByLabelText('Minus 9 ringgit 90 sen')).toBeOnTheScreen();
  expect(await screen.findByLabelText('Minus 2274 ringgit 90 sen')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Hide amounts' })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Hide amounts' }));

  expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
  expect(tree()).not.toMatch(/\d\.\d\d|ringgit/);
  const lists = mockData.filter((d) => Array.isArray(d) && d.length > 0);
  expect(lists.length).toBeGreaterThan(2);
  expect(lists.filter((d) => d !== listData)).toEqual([]);
});
