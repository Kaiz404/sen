import { type Instant, InstantSchema } from '@/models/day';
import { ok } from '@/models/errors';

import { type BankApi, type BankScenario, createMockBank } from './bank-api';
import type { Db, OpenDb } from './db';
import { openTestDb } from './db/testing/node-adapter';
import { logEvent } from './logger';
import { readSyncState, resetBankRows, sync } from './sync';

jest.mock('./logger');

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const LATER = InstantSchema.parse('2026-10-15T09:30:00.000Z');
const NORMAL: BankScenario = { next: 'normal', size: 1000, slow: false, newOnRefresh: false };

const dbs: OpenDb[] = [];
async function freshDb() {
  const db = await openTestDb();
  dbs.push(db);
  return db;
}
afterEach(async () => {
  jest.mocked(logEvent).mockClear();
  await Promise.all(dbs.splice(0).map((db) => db.close()));
});

function mockBank(scenario: Partial<BankScenario> = {}, now: () => Instant = () => NOW) {
  const live = { ...NORMAL, ...scenario };
  return { bank: createMockBank({ scenario: () => live, now, wait: async () => {} }), live };
}

const options = { now: () => LATER };

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

async function tableHash(db: Db): Promise<string> {
  const rows = await db.all('SELECT * FROM tx ORDER BY id');
  const state = await db.all('SELECT * FROM sync_state');
  return fnv1a(JSON.stringify([rows, state]));
}

const count = async (db: Db, where = '1') =>
  (await db.all(`SELECT count(*) AS n FROM tx WHERE ${where}`))[0]?.n;

function dropsAfter(bank: BankApi, pages: number): BankApi {
  let served = 0;
  return {
    fetchPage: async (request) =>
      served++ < pages ? bank.fetchPage(request) : { ok: false, error: { kind: 'offline' } },
  };
}

const MANUAL = `INSERT INTO tx (id, amount_minor, currency, type, description, merchant, category, status,
  posted_at, reference, account_name, account_last4, source, idem_key, search_text)
  VALUES ('m-1', 4250, 'MYR', 'debit', 'Lunch with Hafiz, cash', 'Lunch with Hafiz, cash', 'food', 'posted',
  '2026-10-15T05:42:00.000Z', 'SEN-M-7Q4K2D9X', 'Everyday Savings', '4821', 'manual', 'k-1', 'lunch with hafiz, cash')`;

test('a full sync stores every row once and saves the cursor and time', async () => {
  const db = await freshDb();
  const progress: number[] = [];

  const result = await sync(db, mockBank().bank, {
    ...options,
    onProgress: (n) => progress.push(n),
  });

  expect(result).toEqual(ok({ received: 1000, cursor: 1000 }));
  expect(progress).toEqual([500, 1000]);
  expect(await count(db)).toBe(1000);
  expect(await readSyncState(db)).toEqual({ cursor: 1000, syncedAt: LATER });
});

test('sync twice and sync interrupted end with the same table hash', async () => {
  const once = await freshDb();
  await sync(once, mockBank().bank, options);

  const twice = await freshDb();
  const { bank } = mockBank();
  await sync(twice, bank, options);
  const again = await sync(twice, bank, options);

  const interrupted = await freshDb();
  const dropped = await sync(interrupted, dropsAfter(mockBank().bank, 1), options);
  const halfway = [(await readSyncState(interrupted)).cursor, await count(interrupted)];
  const resumed = await sync(interrupted, mockBank().bank, options);

  expect(again).toEqual(ok({ received: 0, cursor: 1000 }));
  expect(dropped).toEqual({ ok: false, error: { kind: 'offline' } });
  expect(halfway).toEqual([500, 500]);
  expect(resumed).toEqual(ok({ received: 500, cursor: 1000 }));
  expect(await tableHash(twice)).toBe(await tableHash(once));
  expect(await tableHash(interrupted)).toBe(await tableHash(once));
});

test('a write that fails halfway through a page keeps none of that page', async () => {
  const db = await freshDb();
  let inserts = 0;
  const flaky: Db = {
    all: (sql, params) => db.all(sql, params),
    run: (sql, params) => db.run(sql, params),
    transaction: (work) =>
      db.transaction((tx) =>
        work({
          ...tx,
          run: async (sql, params) => {
            if (sql.startsWith('INSERT') && ++inserts === 13) throw new Error('disk I/O error');
            return tx.run(sql, params);
          },
        }),
      ),
  };

  await expect(sync(flaky, mockBank().bank, options)).rejects.toThrow('disk I/O error');
  expect([await count(db), (await readSyncState(db)).cursor]).toEqual([500, 500]);

  await sync(db, mockBank().bank, options);
  const clean = await freshDb();
  await sync(clean, mockBank().bank, options);
  expect(await tableHash(db)).toBe(await tableHash(clean));
});

test('with new rows on, each refresh brings exactly one pending row', async () => {
  const db = await freshDb();
  const { bank, live } = mockBank();
  await sync(db, bank, options);

  live.newOnRefresh = true;
  const first = await sync(db, bank, options);
  const second = await sync(db, bank, options);

  expect([first, second]).toEqual([
    ok({ received: 1, cursor: 1001 }),
    ok({ received: 1, cursor: 1002 }),
  ]);
  expect(
    await db.all("SELECT id, status, posted_at FROM tx WHERE id IN ('bk-1001', 'bk-1002')"),
  ).toEqual([
    { id: 'bk-1001', status: 'pending', posted_at: NOW },
    { id: 'bk-1002', status: 'pending', posted_at: NOW },
  ]);
});

test.each(['offline', 'timeout', 'server'] as const)(
  '"%s" comes back as that error and writes nothing',
  async (kind) => {
    const db = await freshDb();

    expect(await sync(db, mockBank({ next: kind }).bank, options)).toEqual({
      ok: false,
      error: { kind },
    });
    expect([await count(db), (await readSyncState(db)).cursor]).toEqual([0, 0]);
  },
);

test('bad rows are dropped and counted, and the good rows are kept', async () => {
  const db = await freshDb();

  const result = await sync(db, mockBank({ next: 'bad_data', size: 20 }).bank, options);

  expect(result).toEqual({ ok: false, error: { kind: 'invalid_data', skipped: 2 } });
  expect([await count(db), (await readSyncState(db)).cursor]).toEqual([20, 20]);
});

test('a body that is not a page, or a page that never moves the cursor, is a server error', async () => {
  const db = await freshDb();
  const garbage: BankApi = { fetchPage: async () => ok('<html>502</html>') };
  const stuck: BankApi = { fetchPage: async () => ok({ items: [{ id: 'no-seq' }], nextSeq: 7 }) };

  expect(await sync(db, garbage, options)).toEqual({ ok: false, error: { kind: 'server' } });
  expect(await sync(db, stuck, options)).toEqual({ ok: false, error: { kind: 'server' } });
});

test('a bank row can never overwrite or pose as a row added on the phone', async () => {
  const db = await freshDb();
  await db.run(MANUAL);
  const row = {
    seq: 1,
    id: 'm-1',
    amountMinor: 99999,
    currency: 'MYR',
    type: 'credit',
    description: 'Overwritten',
    merchant: 'Overwritten',
    category: 'food',
    status: 'posted',
    postedAt: '2026-10-15T05:42:00.000Z',
    reference: 'FT1',
    account: { name: 'Everyday Savings', last4: '4821' },
    source: 'bank',
  };
  const hostile: BankApi = {
    fetchPage: async () =>
      ok({
        items: [row, { ...row, seq: 2, id: 'bk-claims-manual', source: 'manual' }],
        nextSeq: null,
      }),
  };

  const result = await sync(db, hostile, options);

  expect(result).toEqual({ ok: false, error: { kind: 'invalid_data', skipped: 1 } });
  expect(await db.all('SELECT id, amount_minor, description, source FROM tx')).toEqual([
    { id: 'm-1', amount_minor: 4250, description: 'Lunch with Hafiz, cash', source: 'manual' },
  ]);
});

test('a pending row the bank sends again as posted is updated in place', async () => {
  const db = await freshDb();
  const { bank } = mockBank({ size: 20 });
  await sync(db, bank, options);
  const first = await bank.fetchPage({ since: 19, limit: 1 });
  const tealive = first.ok ? (first.data as { items: Record<string, unknown>[] }).items[0] : null;
  const settles: BankApi = {
    fetchPage: async () =>
      ok({ items: [{ ...tealive, seq: 21, status: 'posted' }], nextSeq: null }),
  };

  expect(await sync(db, settles, options)).toEqual(ok({ received: 1, cursor: 21 }));
  expect(
    await db.all("SELECT id, status FROM tx WHERE description = 'Tealive' AND day = '2026-10-15'"),
  ).toEqual([{ id: 'bk-20', status: 'posted' }]);
  expect(await count(db)).toBe(20);
});

test('a dataset switch drops bank rows and the cursor, keeps added rows, and syncs the new size', async () => {
  const db = await freshDb();
  await db.run(MANUAL);
  const { bank, live } = mockBank();
  await sync(db, bank, options);

  await resetBankRows(db);
  const emptied = [await count(db), await readSyncState(db)];
  live.size = 20;
  const result = await sync(db, bank, options);

  expect(emptied).toEqual([1, { cursor: 0, syncedAt: null }]);
  expect(result).toEqual(ok({ received: 20, cursor: 20 }));
  expect([await count(db, "source = 'bank'"), await count(db, "source = 'manual'")]).toEqual([
    20, 1,
  ]);
});

test('search text is the cleaned, lower-cased description', async () => {
  const db = await freshDb();
  await sync(db, mockBank({ size: 20 }).bank, options);

  expect(await db.all("SELECT search_text FROM tx WHERE id = 'bk-20'")).toEqual([
    { search_text: 'tealive' },
  ]);
  expect(await db.all("SELECT search_text FROM tx WHERE description LIKE 'Grab ride%'")).toEqual([
    { search_text: 'grab ride to kl sentral' },
  ]);
});
