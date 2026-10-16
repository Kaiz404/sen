import { type Instant, InstantSchema } from '@/models/day';

import { type BankScenario, createMockBank } from './bank-api';

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const NORMAL: BankScenario = { next: 'normal', size: 1000, slow: false, newOnRefresh: false };

function bank(patch: Partial<BankScenario> = {}, clock: { now: Instant } = { now: NOW }) {
  const waits: number[] = [];
  const api = createMockBank({
    scenario: () => ({ ...NORMAL, ...patch }),
    now: () => clock.now,
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  return { api, waits };
}

type Body = {
  items: { seq?: number; id: string; status?: string; postedAt?: string }[];
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

test('past the end, a refresh mints one pending row at now, only when asked', async () => {
  const minted = await page(bank({ newOnRefresh: true }).api, 1000);
  const quiet = await page(bank({ newOnRefresh: false }).api, 1000);

  expect(minted).toEqual({
    items: [
      expect.objectContaining({ seq: 1001, id: 'bk-1001', status: 'pending', postedAt: NOW }),
    ],
    nextSeq: null,
  });
  expect(quiet).toEqual({ items: [], nextSeq: null });
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
