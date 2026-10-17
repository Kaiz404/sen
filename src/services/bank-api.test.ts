import { type Instant, InstantSchema } from '@/models/day';

import { type BankScenario, createMockBank } from './bank-api';

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const NORMAL: BankScenario = { next: 'normal', size: 1000, slow: false, newOnRefresh: false };

function bank(patch: Partial<BankScenario> = {}, clock: { now: Instant } = { now: NOW }) {
  const waits: number[] = [];
  const api = createMockBank({
    now: () => clock.now,
    wait: async (ms) => {
      waits.push(ms);
    },
  }).under({ ...NORMAL, ...patch });
  return { api, waits };
}

type Body = {
  items: { seq?: number; id: string; status?: string; postedAt?: string }[];
  modified: { id: string; settledAt: string }[];
  nextSeq: number | null;
};

async function page(
  api: ReturnType<typeof bank>['api'],
  since: number,
  limit = 500,
): Promise<Body> {
  const result = await api.fetchPage({ since, limit });
  if (!result.ok) throw new Error(`expected a page, got ${result.error.kind}`);
  return result.data as Body;
}

const seqs = (body: Body) => body.items.map((item) => item.seq);

test('pages walk the feed in seq order and the last page says there is no more', async () => {
  const { api } = bank();

  const first = await page(api, 0);
  const second = await page(api, 500);

  expect([seqs(first)[0], seqs(first).at(-1), first.nextSeq]).toEqual([1, 500, 500]);
  expect([seqs(second)[0], seqs(second).at(-1), second.nextSeq]).toEqual([501, 1000, null]);
});

const BOARD_POSTED = [
  { id: 'bk-997', settledAt: '2026-10-14T10:22:00.000Z' },
  { id: 'bk-998', settledAt: '2026-10-15T00:44:00.000Z' },
  { id: 'bk-1000', settledAt: '2026-10-15T05:17:00.000Z' },
];

test('past the end, a refresh mints one pending row at now, only when asked', async () => {
  const minted = await page(bank({ newOnRefresh: true }).api, 1000);
  const quiet = await page(bank({ newOnRefresh: false }).api, 1000);

  expect(minted).toEqual({
    items: [
      expect.objectContaining({ seq: 1001, id: 'bk-1001', status: 'pending', postedAt: NOW }),
    ],
    modified: BOARD_POSTED,
    nextSeq: null,
  });
  expect(quiet).toEqual({ items: [], modified: BOARD_POSTED, nextSeq: null });
});

test('a refresh reports pending rows that are two minutes old as posted, at their authorised time plus two minutes', async () => {
  const clock = { now: NOW };
  const { api } = bank({ newOnRefresh: true }, clock);
  await page(api, 1000);

  clock.now = InstantSchema.parse('2026-10-15T08:01:59.999Z');
  const early = await page(api, 1001);
  clock.now = InstantSchema.parse('2026-10-15T08:02:00.000Z');
  const due = await page(api, 1001);

  expect(early.modified.filter((m) => m.id === 'bk-1001')).toEqual([]);
  expect(due.modified.filter((m) => m.id === 'bk-1001')).toEqual([
    { id: 'bk-1001', settledAt: '2026-10-15T08:02:00.000Z' },
  ]);
});

test('the board pending rows are reported on a refresh and never on a page of the feed', async () => {
  const { api } = bank({ size: 20 });

  const feedPage = await page(api, 0);
  const refresh = await page(api, 20);

  expect(feedPage.modified).toEqual([]);
  expect(refresh.modified.map((m) => m.id).sort()).toEqual(['bk-17', 'bk-18', 'bk-20'].sort());
});

test.each(['offline', 'timeout', 'server'] as const)(
  '"%s" fails the request with that kind',
  async (kind) => {
    expect(await bank({ next: kind }).api.fetchPage({ since: 0, limit: 500 })).toEqual({
      ok: false,
      error: { kind },
    });
  },
);

test('"timeout" answers only after its 8 s deadline, and the other faults answer at once', async () => {
  const timeout = bank({ next: 'timeout' });
  const offline = bank({ next: 'offline' });
  const server = bank({ next: 'server' });

  await timeout.api.fetchPage({ since: 0, limit: 10 });
  await offline.api.fetchPage({ since: 0, limit: 10 });
  await server.api.fetchPage({ since: 0, limit: 10 });

  expect([timeout.waits, offline.waits, server.waits]).toEqual([[8000], [], []]);
});

test('"bad_data" adds two broken rows with no seq, and the real rows still arrive', async () => {
  const body = await page(bank({ next: 'bad_data', size: 20 }).api, 0);

  expect(body.items.length).toBe(22);
  expect(body.items.slice(20).map((item) => [item.id, item.seq])).toEqual([
    ['bk-junk-float', undefined],
    ['bk-junk-category', undefined],
  ]);
});

test('slow mode waits 3 s before answering', async () => {
  const slow = bank({ slow: true });
  const fast = bank({ slow: false });

  await slow.api.fetchPage({ since: 0, limit: 10 });
  await fast.api.fetchPage({ since: 0, limit: 10 });

  expect([slow.waits, fast.waits]).toEqual([[3000], []]);
});

test('the feed is generated once, so a page fetched a day later still matches', async () => {
  const clock = { now: NOW };
  const { api } = bank({ size: 20 }, clock);

  const before = await page(api, 0);
  clock.now = InstantSchema.parse('2026-10-16T08:00:00.000Z');
  const after = await page(api, 0);

  expect(after).toEqual(before);
  expect(before.items.at(-1)?.postedAt).toBe('2026-10-15T05:15:00.000Z');
});

test('a bank that restarts finds the row it minted and still posts it', async () => {
  const clock = { now: NOW };
  const saved = { anchor: null as Instant | null, minted: {} as Record<string, never[]> };
  const store = {
    read: () => saved,
    write: (next: typeof saved) => void Object.assign(saved, next),
  };
  const open = () =>
    createMockBank({ now: () => clock.now, wait: async () => {}, state: store }).under({
      ...NORMAL,
      newOnRefresh: true,
    });
  await page(open(), 1000);

  clock.now = InstantSchema.parse('2026-10-15T08:03:00.000Z');
  const restarted = await page(open(), 1001);

  expect(restarted.modified.filter((m) => m.id === 'bk-1001')).toEqual([
    { id: 'bk-1001', settledAt: '2026-10-15T08:02:00.000Z' },
  ]);
});

test('a bank that restarts on another day keeps the feed it had, so board rows keep their authorised times', async () => {
  const clock = { now: NOW };
  const saved = { anchor: null as Instant | null, minted: {} as Record<string, never[]> };
  const store = {
    read: () => saved,
    write: (next: typeof saved) => void Object.assign(saved, next),
  };
  const open = () =>
    createMockBank({ now: () => clock.now, wait: async () => {}, state: store }).under({
      ...NORMAL,
      size: 20,
    });
  const before = await page(open(), 0);

  clock.now = InstantSchema.parse('2026-10-18T08:00:00.000Z');
  const after = await page(open(), 0);
  const refresh = await page(open(), 20);

  expect(after).toEqual(before);
  expect(refresh.modified.map((m) => m.settledAt)).toEqual([
    '2026-10-14T10:22:00.000Z',
    '2026-10-15T00:44:00.000Z',
    '2026-10-15T05:17:00.000Z',
  ]);
});
