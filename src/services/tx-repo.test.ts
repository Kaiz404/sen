import { DayKeySchema, InstantSchema } from '@/models/day';
import { draftSchema } from '@/models/draft';
import { TxIdSchema } from '@/models/transaction';

import { type BankScenario, createMockBank } from './bank-api';
import type { Db, OpenDb } from './db';
import { openTestDb } from './db/testing/node-adapter';
import { generateBankRows } from './seed';
import { sync } from './sync';
import {
  deleteManual,
  eraseManual,
  getRevealedTransaction,
  getTransaction,
  insertManual,
  manualReference,
  NO_FILTER,
  type PageCursor,
  readDayNets,
  readPage,
  readRevealedAmounts,
  readRevealedDayNets,
  readRevealedTotals,
  readTotals,
  restoreDeleted,
  type TxFilter,
} from './tx-repo';

jest.mock('./logger');

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const day = (s: string) => DayKeySchema.parse(s);
const id = (s: string) => TxIdSchema.parse(s);
const OCTOBER = { from: day('2026-10-01'), to: day('2026-10-15') };

async function seeded(size: BankScenario['size']): Promise<OpenDb> {
  const db = await openTestDb();
  const scenario: BankScenario = { next: 'normal', size, slow: false, newOnRefresh: false };
  await sync(db, createMockBank({ now: () => NOW }).under(scenario), { now: () => NOW });
  return db;
}

async function allPages(db: Db, filter: TxFilter = NO_FILTER) {
  const ids: string[] = [];
  let after: PageCursor | null = null;
  let pages = 0;
  do {
    const page = await readPage(db, { filter, after });
    ids.push(...page.rows.map((row) => row.id));
    after = page.next;
    pages++;
  } while (after !== null);
  return { ids, pages };
}

function numbers(value: unknown, key = ''): [string, number][] {
  if (typeof value === 'number') return [[key, value]];
  if (value instanceof Map) return [...value.entries()].flatMap(([k, v]) => numbers(v, String(k)));
  if (Array.isArray(value)) return value.flatMap((v) => numbers(v, key));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => numbers(v, k));
  }
  return [];
}

const LUNCH = {
  idemKey: '0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1',
  amountMinor: 4250,
  direction: 'debit',
  description: 'Lunch with Hafiz, cash',
  category: 'food',
  day: '2026-10-15',
};
const draft = (patch: Partial<typeof LUNCH> = {}) =>
  draftSchema(day('2026-10-15')).parse({ ...LUNCH, ...patch });

describe('reads on 1,000 rows', () => {
  let db: OpenDb;
  beforeAll(async () => {
    db = await seeded(1000);
  });
  afterAll(() => db.close());

  test('keyset pages of 100 walk every row once, newest first', async () => {
    const { ids, pages } = await allPages(db);

    expect([ids.length, new Set(ids).size, pages]).toEqual([1000, 1000, 10]);
    expect(ids.slice(0, 3)).toEqual(['bk-1000', 'bk-999', 'bk-998']);
    expect(ids.at(-1)).toBe('bk-1');
  });

  test('masked reads hold no amounts, and their revealed forms do', async () => {
    const first = await readPage(db, { filter: NO_FILTER, after: null });
    const masked = [
      first,
      await readTotals(db, { filter: NO_FILTER, days: OCTOBER }),
      await readTotals(db, { filter: { flow: 'out', search: 'grab' } }),
      await readDayNets(db, { filter: NO_FILTER, days: OCTOBER }),
      await getTransaction(db, id('bk-997')),
    ];
    const revealed = [
      await readRevealedAmounts(db, { filter: NO_FILTER, through: first.next! }),
      await readRevealedTotals(db, { filter: NO_FILTER, days: OCTOBER }),
      await readRevealedDayNets(db, { filter: NO_FILTER, days: OCTOBER }),
      await getRevealedTransaction(db, id('bk-997')),
    ];

    expect(new Set(numbers(masked).map(([key]) => key))).toEqual(new Set(['skipped', 'count']));
    expect(JSON.stringify(masked)).not.toMatch(/amount|minor|net/i);
    expect(new Set(numbers(revealed).map(([key]) => key))).toEqual(
      new Set([
        'bk-1000',
        'count',
        'minor',
        'netMinor',
        'amountMinor',
        ...first.rows.map((r) => r.id),
      ]),
    );
  });

  test('October so far matches the boards’ month card, by count masked and by sum revealed', async () => {
    expect(await readTotals(db, { filter: NO_FILTER, days: OCTOBER })).toEqual({
      in: { count: 2 },
      out: { count: 18 },
    });
    expect(await readRevealedTotals(db, { filter: NO_FILTER, days: OCTOBER })).toEqual({
      in: { count: 2, minor: 685000 },
      out: { count: 18, minor: 227490 },
    });
  });

  test('day nets are grouped by Malaysia day, newest first, and the 7:30 am reload lands on the 14th', async () => {
    const days = { from: day('2026-10-13'), to: day('2026-10-15') };

    expect(await readRevealedDayNets(db, { filter: NO_FILTER, days })).toEqual([
      { day: '2026-10-15', count: 3, netMinor: 35000 - 990 - 1850 },
      { day: '2026-10-14', count: 3, netMinor: -(14260 + 5680 + 5000) },
      { day: '2026-10-13', count: 2, netMinor: 650000 - 2430 },
    ]);
    expect(await readDayNets(db, { filter: { flow: 'in', search: '' }, days })).toEqual([
      { day: '2026-10-15', count: 1 },
      { day: '2026-10-13', count: 1 },
    ]);
  });

  test('In shows only money in and Out only money out', async () => {
    const credits = await allPages(db, { flow: 'in', search: '' });
    const debits = await allPages(db, { flow: 'out', search: '' });
    const types = async (ids: string[]) =>
      new Set((await Promise.all(ids.map((i) => getTransaction(db, id(i))))).map((r) => r?.type));

    expect(credits.ids.length + debits.ids.length).toBe(1000);
    expect([await types(credits.ids), await types(debits.ids)]).toEqual([
      new Set(['credit']),
      new Set(['debit']),
    ]);
    expect(await readTotals(db, { filter: { flow: 'in', search: '' }, days: OCTOBER })).toEqual({
      in: { count: 2 },
      out: { count: 0 },
    });
  });

  test('the revealed amounts cover the loaded rows, from the newest through the cursor', async () => {
    const first = await readPage(db, { filter: NO_FILTER, after: null });
    const amounts = await readRevealedAmounts(db, { filter: NO_FILTER, through: first.next! });

    expect(amounts.size).toBe(100);
    expect([...amounts.keys()].sort()).toEqual(first.rows.map((row) => row.id).sort());
    expect(amounts.get(id('bk-1000'))).toBe(990);
  });

  test('detail reads one row, masked with its day or revealed with its amount', async () => {
    const tnb = id('bk-997');

    expect(await getTransaction(db, tnb)).toMatchObject({
      description: 'TNB electricity',
      day: '2026-10-14',
      reference: 'FT26101400478213',
    });
    expect((await getRevealedTransaction(db, tnb))?.amountMinor).toBe(14260);
    expect(await getTransaction(db, id('nope'))).toBeNull();
    expect(await getRevealedTransaction(db, id('nope'))).toBeNull();
  });
});

test('search "entral" on 10,000 rows matches a JS filter over the same seed', async () => {
  const db = await seeded(10000);
  const expected = generateBankRows(10000, NOW)
    .filter((row) => row.description.toLowerCase().includes('entral'))
    .sort((a, b) =>
      a.postedAt === b.postedAt ? (a.id < b.id ? 1 : -1) : a.postedAt < b.postedAt ? 1 : -1,
    )
    .map((row) => row.id);

  const found = await allPages(db, { flow: 'all', search: 'entral' });
  const counted = await readTotals(db, { filter: { flow: 'all', search: ' ENTRAL ' } });

  expect(expected.length).toBe(416);
  expect(found.ids).toEqual(expected);
  expect(counted.in.count + counted.out.count).toBe(416);
  await db.close();
});

describe('writes', () => {
  let db: OpenDb;
  beforeEach(async () => {
    db = await seeded(20);
  });
  afterEach(() => db.close());

  test('an added row is stored once per idempotency key', async () => {
    const first = await insertManual(db, draft(), NOW);
    const repeat = await insertManual(db, draft({ amountMinor: 9999 }), NOW);

    expect(first).toEqual({
      created: true,
      row: {
        id: 'm-0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1',
        currency: 'MYR',
        type: 'debit',
        description: 'Lunch with Hafiz, cash',
        merchant: 'Lunch with Hafiz, cash',
        category: 'food',
        status: 'posted',
        postedAt: NOW,
        day: '2026-10-15',
        reference: manualReference(LUNCH.idemKey),
        account: { name: 'Everyday Savings', last4: '4821' },
        source: 'manual',
      },
    });
    expect(repeat).toEqual({ ...first, created: false });
    expect(await getRevealedTransaction(db, first.row.id)).toMatchObject({ amountMinor: 4250 });
    expect(await db.all("SELECT count(*) AS n FROM tx WHERE source = 'manual'")).toEqual([
      { n: 1 },
    ]);
  });

  test('a row added for a past day keeps the time of day, so it is never in the future', async () => {
    const { row } = await insertManual(db, draft({ day: '2026-10-02' }), NOW);

    expect([row.postedAt, row.day]).toEqual(['2026-10-02T08:00:00.000Z', '2026-10-02']);
  });

  test('a manual reference is SEN-M- and eight Crockford characters from the key', () => {
    expect(manualReference('0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1')).toBe('SEN-M-1DQHREBZ');
  });

  test('search escapes % and _ so they match only themselves', async () => {
    await insertManual(db, draft({ description: '100% cashback' }), NOW);
    await insertManual(
      db,
      draft({ idemKey: '1b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1', description: 'tea_time' }),
      NOW,
    );
    const search = async (text: string) =>
      (await readPage(db, { filter: { flow: 'all', search: text }, after: null })).rows.map(
        (r) => r.description,
      );

    expect(await search('%')).toEqual(['100% cashback']);
    expect(await search('_')).toEqual(['tea_time']);
    expect(await search('a_t')).toEqual(['tea_time']);
  });

  test('delete removes an added row, refuses a bank row, and undo restores the same row', async () => {
    const { row } = await insertManual(db, draft(), NOW);
    const before = await db.all('SELECT * FROM tx WHERE id = ?', [row.id]);

    const outcomes = [
      await deleteManual(db, row.id),
      await deleteManual(db, id('bk-20')),
      await deleteManual(db, id('nope')),
    ];
    const gone = await getTransaction(db, row.id);
    const restored = await restoreDeleted(db, row.id);
    const again = await restoreDeleted(db, row.id);
    const copies = await db.all("SELECT count(*) AS n FROM meta WHERE key LIKE 'undo.%'");

    expect(outcomes).toEqual(['deleted', 'read_only', 'missing']);
    expect(gone).toBeNull();
    expect([restored, again]).toEqual([true, false]);
    expect(copies).toEqual([{ n: 0 }]);
    expect(await db.all('SELECT * FROM tx WHERE id = ?', [row.id])).toEqual(before);
    expect(await getTransaction(db, id('bk-20'))).toMatchObject({ description: 'Tealive' });
  });

  test('erase removes every added row and the undo copy, and keeps bank rows', async () => {
    const { row } = await insertManual(db, draft(), NOW);
    await insertManual(db, draft({ idemKey: '1b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1' }), NOW);
    await deleteManual(db, row.id);

    expect(await eraseManual(db)).toBe(1);
    expect(await restoreDeleted(db, row.id)).toBe(false);
    expect(await db.all('SELECT source, count(*) AS n FROM tx GROUP BY source')).toEqual([
      { source: 'bank', n: 20 },
    ]);
  });
});
