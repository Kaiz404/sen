import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Share, StyleSheet } from 'react-native';

import { toast, ToastHost } from '@/components/toast';
import { DayKeySchema, InstantSchema } from '@/models/day';
import { draftSchema } from '@/models/draft';
import type { TxId } from '@/models/transaction';
import { createMockBank } from '@/services/bank-api';
import { copySensitive } from '@/services/clipboard';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { sessionStore } from '@/features/auth/session';
import { clearPrefs } from '@/services/prefs';
import { QK, queryClient } from '@/services/query-client';
import { sync } from '@/services/sync';
import { deleteManual, insertManual } from '@/services/tx-repo';

import { DetailScreen } from './detail-screen';

let mockDb: OpenDb;
let mockId = '';
let mockShowResult: { ok: false; reason: string } | null = null;
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn() };

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('@/services/clipboard', () => ({ copySensitive: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  showAmounts: async () => {
    if (mockShowResult) return mockShowResult;
    jest.requireActual('@/features/auth/session').sessionStore.setState({ amountsHidden: false });
    return { ok: true };
  },
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');
const KEY = '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const ADDED = `m-${KEY}`;
let tnb = '';

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
  mockShowResult = null;
  sessionStore.setState({ amountsHidden: true });
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockRouter.canGoBack.mockReturnValue(true);
  queryClient.clear();
  mockDb = await openTestDb();
  const now = InstantSchema.parse(NOW.toISOString());
  const scenario = { next: 'normal', size: 20, slow: false, newOnRefresh: false } as const;
  await sync(mockDb, createMockBank({ now: () => now }).under(scenario), {
    now: () => now,
  });
  const today = DayKeySchema.parse('2026-10-15');
  const draft = draftSchema(today).parse({
    idemKey: KEY,
    amountMinor: 4250,
    direction: 'debit',
    description: 'Lunch with Hafiz, cash',
    category: 'food',
    day: today,
  });
  await insertManual(mockDb, draft, now);
  const [row] = await mockDb.all("SELECT id FROM tx WHERE description = 'TNB electricity'");
  tnb = String(row?.id);
});
afterEach(async () => {
  await act(async () => toast.hide());
  await mockDb.close();
  jest.useRealTimers();
});

async function renderDetail(id: string) {
  mockId = id;
  await render(
    <QueryClientProvider client={queryClient}>
      <DetailScreen />
      <ToastHost />
    </QueryClientProvider>,
  );
}

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
  );

const fact = (label: string) => screen.getByText(label).parent;

test('the receipt clears the status bar at the top and the gesture bar at the end', async () => {
  await renderDetail(tnb);
  expect(await screen.findByText('TNB electricity')).toBeOnTheScreen();
  expect(StyleSheet.flatten(screen.getByTestId('detail').props.contentContainerStyle)).toMatchObject({
    paddingTop: 48 + 18,
    paddingBottom: 34 + 28,
  });
});

test('while hidden the receipt shows every field but the amount, and no amount is in the tree or the cache', async () => {
  await renderDetail(tnb);

  expect(await screen.findByText('TNB electricity')).toBeOnTheScreen();
  expect(within(fact('MERCHANT')!).getByText('Tenaga Nasional Berhad')).toBeOnTheScreen();
  expect(within(fact('CATEGORY')!).getByText('Bills & utilities')).toBeOnTheScreen();
  expect(within(fact('DATE & TIME')!).getByText('Wed 14 Oct 2026, 6:20 pm')).toBeOnTheScreen();
  expect(within(fact('ACCOUNT')!).getByText('Everyday Savings ·· 4821')).toBeOnTheScreen();
  expect(within(fact('TYPE')!).getByText('Debit, money out')).toBeOnTheScreen();
  expect(within(fact('STATUS')!).getByText('Pending')).toBeOnTheScreen();
  expect(screen.getByText('FT26101400478213')).toBeOnTheScreen();
  expect(screen.getByText('MONEY OUT · WED 14 OCT 2026 · 6:20 PM')).toBeOnTheScreen();
  expect(screen.getAllByLabelText('Amount hidden')).toHaveLength(2);
  expect(screen.queryByLabelText('Payment progress, step 2 of 3')).not.toBeOnTheScreen();

  expect(tree()).not.toMatch(/\d\.\d\d|ringgit|142/);
  expect(cache()).not.toMatch(/amountMinor|14260/);
  expect(queryClient.getQueriesData({ queryKey: QK.revealed })).toEqual([
    [['tx', 'revealed', 'detail', tnb], undefined],
  ]);
});

test('after a later refresh posts it, the receipt reads Posted with all three steps done, and hiding still shows no amount', async () => {
  const later = InstantSchema.parse('2026-10-15T07:00:00.000Z');
  const scenario = { next: 'normal', size: 20, slow: false, newOnRefresh: false } as const;
  await sync(mockDb, createMockBank({ now: () => later }).under(scenario), { now: () => later });
  await renderDetail(tnb);

  expect(await screen.findByText('TNB electricity')).toBeOnTheScreen();
  expect(within(fact('STATUS')!).getByText('Posted')).toBeOnTheScreen();
  expect(screen.queryByText('Pending')).not.toBeOnTheScreen();
  expect(tree()).not.toMatch(/\d\.\d\d|ringgit|142/);
  expect(cache()).not.toMatch(/amountMinor|14260/);

  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));

  expect(await screen.findByLabelText('Minus 142 ringgit 60 sen')).toBeOnTheScreen();
  expect(screen.getByLabelText('Payment progress, step 3 of 3')).toBeOnTheScreen();
  expect(screen.getByText('WED 6:22 PM')).toBeOnTheScreen();
  expect(screen.getByText('CLEARED')).toBeOnTheScreen();
  expect(screen.queryByText('NEXT')).not.toBeOnTheScreen();
});

test('the masked receipt has the Show amounts key and no helper line', async () => {
  await renderDetail(tnb);

  expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
  expect(screen.queryByText(/Asks for .* first\. Stays shown/)).not.toBeOnTheScreen();
});

test('Show amounts rolls the amount in, and Hide amounts takes it out of the tree', async () => {
  await renderDetail(tnb);
  await fireEvent.press(await screen.findByRole('button', { name: 'Show amounts' }));

  expect(await screen.findByLabelText('Minus 142 ringgit 60 sen')).toBeOnTheScreen();
  expect(screen.getByLabelText('142 ringgit 60 sen')).toBeOnTheScreen();
  expect(cache()).toMatch(/"amountMinor":14260/);
  expect(screen.getByLabelText('Payment progress, step 2 of 3')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Hide amounts' }));

  expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
  expect(tree()).not.toMatch(/\d\.\d\d|ringgit|142/);
});

test.each([
  ['noLock', 'Amounts are still hidden. Set a screen lock to use Sen.'],
  ['unavailable', "The check isn't available right now. Try again soon."],
  ['timedOut', 'The check timed out. Amounts are still hidden. Try again.'],
] as const)('Show amounts refused for %s says why and keeps them hidden', async (reason, title) => {
  const shown = jest.spyOn(toast, 'show');
  mockShowResult = { ok: false, reason };
  await renderDetail(tnb);

  await fireEvent.press(await screen.findByRole('button', { name: 'Show amounts' }));
  await act(() => Promise.resolve());

  expect(shown).toHaveBeenCalledWith({ title });
  expect(sessionStore.getState().amountsHidden).toBe(true);
  shown.mockRestore();
});

test('Show amounts cancelled stays silent', async () => {
  const shown = jest.spyOn(toast, 'show');
  mockShowResult = { ok: false, reason: 'cancelled' };
  await renderDetail(tnb);

  await fireEvent.press(await screen.findByRole('button', { name: 'Show amounts' }));
  await act(() => Promise.resolve());

  expect(shown).not.toHaveBeenCalled();
  shown.mockRestore();
});

test('an added row offers delete through the sheet, and says where it came from', async () => {
  await renderDetail(ADDED);

  expect(await screen.findByText('Lunch with Hafiz, cash')).toBeOnTheScreen();
  expect(screen.getByText('Added on this phone, 15 Oct 2:00 pm')).toBeOnTheScreen();
  expect(screen.queryByText('MERCHANT')).not.toBeOnTheScreen();
  expect(within(fact('TYPE')!).getByText('Money out')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Delete transaction' }));
  expect(mockRouter.push).toHaveBeenCalledWith(`/transaction/${ADDED}/delete`);
});

test('a bank row is read only: no delete key', async () => {
  await renderDetail(tnb);

  expect(await screen.findByText('From your bank · read only')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Delete transaction' })).not.toBeOnTheScreen();
});

test.each([
  ['an id that was never stored', 'm-gone'],
  ['an id over 64 characters', 'm-'.padEnd(65, 'x')],
  ['an empty id', ''],
])('%s shows not found, and Back goes home when there is no screen behind', async (_case, id) => {
  mockRouter.canGoBack.mockReturnValue(false);
  await renderDetail(id);

  expect(
    await screen.findByRole('header', { name: 'This transaction isn’t here any more' }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    within(screen.getByTestId('detail-missing')).getByRole('button', { name: 'Back to history' }),
  );
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});

test('a row deleted while its receipt is open turns into not found', async () => {
  await renderDetail(ADDED);
  expect(await screen.findByText('Lunch with Hafiz, cash')).toBeOnTheScreen();

  await act(async () => {
    await deleteManual(mockDb, ADDED as TxId);
    await queryClient.invalidateQueries({ queryKey: QK.tx });
  });

  expect(
    await screen.findByRole('header', { name: 'This transaction isn’t here any more' }),
  ).toBeOnTheScreen();
});

test('a read that throws shows the error, and Retry reads again', async () => {
  const all = jest.spyOn(mockDb, 'all').mockRejectedValueOnce(new Error('disk I/O error'));
  await renderDetail(tnb);

  expect(
    await screen.findByRole('header', { name: 'Couldn’t load this receipt' }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('TNB electricity')).toBeOnTheScreen();
  expect(all).toHaveBeenCalledTimes(2);
});

test('Copy puts the reference on the clipboard as sensitive, then the key settles back', async () => {
  jest.mocked(copySensitive).mockResolvedValue(true);
  await renderDetail(tnb);

  await fireEvent.press(
    await screen.findByRole('button', { name: 'Copy reference FT26101400478213' }),
  );

  expect(copySensitive).toHaveBeenCalledWith('FT26101400478213');
  expect(screen.getByRole('button', { name: 'Reference copied' })).toBeOnTheScreen();
  expect(screen.getByText('Reference copied')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(2500));
  expect(screen.getByRole('button', { name: 'Copy reference FT26101400478213' })).toBeOnTheScreen();
});

test('a copy that fails says so and points at the selectable reference', async () => {
  jest.mocked(copySensitive).mockResolvedValue(false);
  await renderDetail(tnb);

  await fireEvent.press(
    await screen.findByRole('button', { name: 'Copy reference FT26101400478213' }),
  );

  expect(await screen.findByText('Couldn’t copy')).toBeOnTheScreen();
  expect(screen.getByText('Press and hold the reference to copy it.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Reference copied' })).not.toBeOnTheScreen();
});

test('Share receipt is offered only while shown, and hands the share sheet plain text', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  await renderDetail(tnb);

  expect(
    await screen.findByText('Show amounts to share this receipt. Sen never shares hidden amounts.'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Share receipt' })).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Share receipt' }));

  expect(share.mock.calls).toEqual([
    [
      {
        message: [
          'Sen receipt',
          'TNB electricity · Tenaga Nasional Berhad',
          '−RM\u2009142.60 · Pending',
          'Wed 14 Oct 2026, 6:20 pm',
          'Everyday Savings ·· 4821',
          'Debit, money out · Bills & utilities',
          'Ref FT26101400478213',
        ].join('\n'),
      },
    ],
  ]);
  share.mockRestore();
});
