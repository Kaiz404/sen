import { DayKeySchema, InstantSchema } from '@/models/day';
import { TxIdSchema } from '@/models/transaction';

import { type BankScenario, createMockBank } from './bank-api';
import type { OpenDb } from './db';
import { openTestDb } from './db/testing/node-adapter';
import { sync } from './sync';
import {
  getTransaction,
  NO_FILTER,
  type PageCursor,
  readPage,
  readRevealedAmounts,
  readRevealedDayNets,
  readRevealedTotals,
  readTotals,
} from './tx-repo';

jest.mock('./logger');

/** D20: each read on Node within 16 ms, search within 100 ms, both at p95. Jest on WSL, not a phone. */
const SELECTOR_MS = 16;
const SEARCH_MS = 100;
const RUNS = 50;
const WARMUP = 5;

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const OCTOBER = { from: DayKeySchema.parse('2026-10-01'), to: DayKeySchema.parse('2026-10-15') };
const WEEK = { from: DayKeySchema.parse('2026-10-09'), to: DayKeySchema.parse('2026-10-15') };
const SEARCH = { flow: 'all', search: 'entral' } as const;

let db: OpenDb;
let syncMs = 0;
let midway: PageCursor;
let threePages: PageCursor;

beforeAll(async () => {
  db = await openTestDb();
  const scenario: BankScenario = { next: 'normal', size: 10000, slow: false, newOnRefresh: false };
  const started = process.hrtime.bigint();
  await sync(db, createMockBank({ scenario: () => scenario, now: () => NOW }), { now: () => NOW });
  syncMs = Number(process.hrtime.bigint() - started) / 1e6;
  const row5000 = await getTransaction(db, TxIdSchema.parse('bk-5000'));
  midway = { postedAt: row5000!.postedAt, id: row5000!.id };
  threePages = (await readPage(db, { filter: NO_FILTER, after: null, limit: 300 })).next!;
});
afterAll(() => db.close());

type Stats = { p50: number; p95: number; max: number };

async function measure(work: () => Promise<unknown>): Promise<Stats> {
  for (let i = 0; i < WARMUP; i++) await work();
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const started = process.hrtime.bigint();
    await work();
    times.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  times.sort((a, b) => a - b);
  const at = (q: number) =>
    times[Math.min(times.length - 1, Math.ceil(q * times.length) - 1)] ?? NaN;
  return { p50: at(0.5), p95: at(0.95), max: times[times.length - 1] ?? NaN };
}

const report: string[] = [];
afterAll(() => {
  if (process.env.BENCH_REPORT !== '1') return;
  process.stdout.write(
    `\nJest bench, 10,000 rows (seed 57), node:sqlite on WSL, ${RUNS} runs after ${WARMUP} warm-up\n` +
      `sync of 10,000 rows: ${syncMs.toFixed(0)} ms (one run)\n${report.join('\n')}\n`,
  );
});

const cases: [string, number, () => Promise<unknown>][] = [
  ['first masked page of 100', SELECTOR_MS, () => readPage(db, { filter: NO_FILTER, after: null })],
  [
    'first page, the SQL alone, no parse',
    SELECTOR_MS,
    () =>
      db.all(
        `SELECT id, currency, type, description, merchant, category, status, posted_at, day, reference,
          account_name, account_last4, source FROM tx ORDER BY posted_at DESC, id DESC LIMIT 101`,
      ),
  ],
  [
    'masked page of 100 after row 5,000',
    SELECTOR_MS,
    () =>
      readPage(db, {
        filter: NO_FILTER,
        after: {
          postedAt: InstantSchema.parse('2025-10-15T00:00:00.000Z'),
          id: TxIdSchema.parse('bk-5000'),
        },
      }),
  ],
  ['month counts, masked', SELECTOR_MS, () => readTotals(db, { filter: NO_FILTER, days: OCTOBER })],
  [
    'month sums, revealed',
    SELECTOR_MS,
    () => readRevealedTotals(db, { filter: NO_FILTER, days: OCTOBER }),
  ],
  [
    '7 day nets, revealed',
    SELECTOR_MS,
    () => readRevealedDayNets(db, { filter: NO_FILTER, days: WEEK }),
  ],
  [
    'revealed amounts for 300 loaded rows',
    SELECTOR_MS,
    () =>
      readRevealedAmounts(db, {
        filter: NO_FILTER,
        through: {
          postedAt: InstantSchema.parse('2026-09-24T00:00:00.000Z'),
          id: TxIdSchema.parse('bk-9700'),
        },
      }),
  ],
  ['detail row, masked', SELECTOR_MS, () => getTransaction(db, TxIdSchema.parse('bk-9997'))],
  [
    'search "entral": first page and count',
    SEARCH_MS,
    () =>
      Promise.all([
        readPage(db, { filter: SEARCH, after: null }),
        readTotals(db, { filter: SEARCH }),
      ]),
  ],
];

test('the benched reads do the real work', async () => {
  const search = await readPage(db, { filter: SEARCH, after: null });
  const counted = await readTotals(db, { filter: SEARCH });
  const later = await readPage(db, { filter: NO_FILTER, after: midway });

  expect(search.rows.length).toBe(100);
  expect(counted.in.count + counted.out.count).toBe(416);
  expect([later.rows.length, later.rows[0]?.id]).toEqual([100, 'bk-4999']);
  expect((await readRevealedAmounts(db, { filter: NO_FILTER, through: threePages })).size).toBe(
    300,
  );
});

test.each(cases)('%s stays inside %i ms at p95', async (name, budget, work) => {
  const stats = await measure(work);
  report.push(
    `${name}: p50 ${stats.p50.toFixed(2)} ms, p95 ${stats.p95.toFixed(2)} ms, max ${stats.max.toFixed(2)} ms (budget ${budget} ms)`,
  );
  expect(stats.p95).toBeLessThanOrEqual(budget);
});
