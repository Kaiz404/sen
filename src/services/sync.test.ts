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
  return createMockBank({ now, wait: async () => {} }).under({ ...NORMAL, ...scenario });
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

  const result = await sync(db, mockBank(), {
    ...options,
    onProgress: (n) => progress.push(n),
  });

  expect(result).toEqual(ok({ received: 1000, cursor: 1000 }));
  expect(progress).toEqual([500, 1000]);
  expect(await count(db)).toBe(1000);
  expect(await readSyncState(db)).toEqual({ cursor: 1000, syncedAt: LATER, complete: true });
});

test('a sync that stops short leaves the feed incomplete, the next one finishes it, and a reset clears it', async () => {
  const db = await freshDb();
  const real = mockBank({ size: 20 });
  let pages = 0;
  const interrupted: BankApi = {
    fetchPage: async (request) =>
      ++pages > 1 ? { ok: false, error: { kind: 'offline' } } : real.fetchPage(request),
  };

  await sync(db, interrupted, { ...options, pageSize: 5 });
  const cut = await readSyncState(db);
  await sync(db, real, options);
  const done = await readSyncState(db);
  await resetBankRows(db);

  expect([cut.cursor, cut.complete]).toEqual([5, false]);
  expect([done.cursor, done.complete]).toEqual([20, true]);
  expect((await readSyncState(db)).complete).toBe(false);
});

test('an interrupted sync ends with the same table as a clean one, and a refresh changes only status and settled_at', async () => {
  const once = await freshDb();
  const clean = mockBank();
  await sync(once, clean, options);

  const twice = await freshDb();
  const bank = mockBank();
  await sync(twice, bank, options);
  const refresh = await sync(twice, bank, options);
  const again = await sync(twice, bank, options);
  const refreshed = await tableHash(twice);

  const interrupted = await freshDb();
  const dropped = await sync(interrupted, dropsAfter(mockBank(), 1), options);
  const halfway = [(await readSyncState(interrupted)).cursor, await count(interrupted)];
  const resumed = await sync(interrupted, mockBank(), options);

  const body = (db: Db) =>
    db.all(
      `SELECT id, amount_minor, currency, type, description, merchant, category, posted_at, reference, source
        FROM tx ORDER BY id`,
    );
  const differing = await twice.all(
    `SELECT id, status, settled_at FROM tx WHERE status = 'posted' AND settled_at IS NOT NULL ORDER BY id`,
  );

  expect(refresh).toEqual(ok({ received: 0, cursor: 1000 }));
  expect(again).toEqual(ok({ received: 0, cursor: 1000 }));
  expect(await tableHash(twice)).toBe(refreshed);
  expect(dropped).toEqual({ ok: false, error: { kind: 'offline' } });
  expect(halfway).toEqual([500, 500]);
  expect(resumed).toEqual(ok({ received: 500, cursor: 1000 }));
  expect(await tableHash(interrupted)).toBe(await tableHash(once));
  expect(await body(twice)).toEqual(await body(once));
  expect(differing.map((r) => r.id)).toEqual(['bk-1000', 'bk-997', 'bk-998']);
  expect(await count(twice, "status = 'pending'")).toBe(0);
  expect(await count(once, "status = 'pending'")).toBe(3);
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

  await expect(sync(flaky, mockBank(), options)).rejects.toThrow('disk I/O error');
  expect([await count(db), (await readSyncState(db)).cursor]).toEqual([500, 500]);

  await sync(db, mockBank(), options);
  const clean = await freshDb();
  await sync(clean, mockBank(), options);
  expect(await tableHash(db)).toBe(await tableHash(clean));
});

test('with new rows on, each refresh brings exactly one pending row', async () => {
  const db = await freshDb();
  await sync(db, mockBank(), options);

  const bank = mockBank({ newOnRefresh: true });
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

    expect(await sync(db, mockBank({ next: kind }), options)).toEqual({
      ok: false,
      error: { kind },
    });
    expect([await count(db), (await readSyncState(db)).cursor]).toEqual([0, 0]);
  },
);

test('bad rows are dropped and counted, and the good rows are kept', async () => {
  const db = await freshDb();

  const result = await sync(db, mockBank({ next: 'bad_data', size: 20 }), options);

  expect(result).toEqual({ ok: false, error: { kind: 'invalid_data', skipped: 2 } });
  expect([await count(db), (await readSyncState(db)).cursor]).toEqual([20, 20]);
});

test('a paged sync under bad data counts the two bad rows once', async () => {
  const db = await freshDb();

  const result = await sync(db, mockBank({ next: 'bad_data', size: 1000 }), {
    ...options,
    pageSize: 500,
  });

  expect(result).toEqual({ ok: false, error: { kind: 'invalid_data', skipped: 2 } });
  expect(await count(db)).toBe(1000);
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
  const bank = mockBank({ size: 20 });
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
  await sync(db, mockBank(), options);

  await resetBankRows(db);
  const emptied = [await count(db), await readSyncState(db)];
  const result = await sync(db, mockBank({ size: 20 }), options);

  expect(emptied).toEqual([1, { cursor: 0, syncedAt: null, complete: false }]);
  expect(result).toEqual(ok({ received: 20, cursor: 20 }));
  expect([await count(db, "source = 'bank'"), await count(db, "source = 'manual'")]).toEqual([
    20, 1,
  ]);
});

test('a reset that lands while the first page is in flight keeps that page out of the new table', async () => {
  const db = await freshDb();
  const bank = mockBank({ size: 1000 });
  let resetting: Promise<void> = Promise.resolve();
  const resetMidPage: BankApi = {
    fetchPage: async (request) => {
      resetting = resetBankRows(db);
      await resetting;
      return bank.fetchPage(request);
    },
  };

  const stale = await sync(db, resetMidPage, options);
  await resetting;

  expect(stale).toEqual(ok({ received: 0, cursor: 0 }));
  expect([await count(db), await readSyncState(db)]).toEqual([
    0,
    { cursor: 0, syncedAt: null, complete: false },
  ]);
  expect(await sync(db, mockBank({ size: 20 }), options)).toEqual(ok({ received: 20, cursor: 20 }));
});

test('search text is the cleaned, lower-cased description', async () => {
  const db = await freshDb();
  await sync(db, mockBank({ size: 20 }), options);

  expect(await db.all("SELECT search_text FROM tx WHERE id = 'bk-20'")).toEqual([
    { search_text: 'tealive' },
  ]);
  expect(await db.all("SELECT search_text FROM tx WHERE description LIKE 'Grab ride%'")).toEqual([
    { search_text: 'grab ride to kl sentral' },
  ]);
});

describe('pending rows post on a later refresh', () => {
  const clock = { now: NOW };
  const board = (db: Db) =>
    db.all(
      "SELECT description, status, settled_at FROM tx WHERE id IN ('bk-17', 'bk-18', 'bk-20') ORDER BY id",
    );
  const settledBank = () =>
    createMockBank({ now: () => clock.now, wait: async () => {} }).under({
      ...NORMAL,
      size: 20,
    });

  beforeEach(() => {
    clock.now = NOW;
  });

  test('the first sync keeps the board rows pending, and the next refresh posts them with the time', async () => {
    const db = await freshDb();
    const bank = settledBank();

    await sync(db, bank, options);
    const first = await board(db);
    clock.now = LATER;
    const refreshed = await sync(db, bank, options);
    const posted = await board(db);

    expect(first.map((r) => r.status)).toEqual(['pending', 'pending', 'pending']);
    expect(refreshed).toEqual(ok({ received: 0, cursor: 20 }));
    expect(posted.map((r) => r.status)).toEqual(['posted', 'posted', 'posted']);
    expect(posted.map((r) => r.settled_at)).toEqual([
      '2026-10-14T10:22:00.000Z',
      '2026-10-15T00:44:00.000Z',
      '2026-10-15T05:17:00.000Z',
    ]);
  });

  test('a row minted by a refresh stays pending until two minutes later, then posts with its amount and time unchanged', async () => {
    const db = await freshDb();
    const bank = createMockBank({ now: () => clock.now, wait: async () => {} }).under({
      ...NORMAL,
      size: 20,
      newOnRefresh: true,
    });
    await sync(db, bank, options);
    await sync(db, bank, options);
    const amount = () => db.all("SELECT amount_minor FROM tx WHERE id = 'bk-21'");
    const before = await amount();

    clock.now = InstantSchema.parse('2026-10-15T08:01:00.000Z');
    await sync(db, bank, options);
    const early = await db.all("SELECT status FROM tx WHERE id = 'bk-21'");
    clock.now = InstantSchema.parse('2026-10-15T08:03:00.000Z');
    await sync(db, bank, options);

    expect(early).toEqual([{ status: 'pending' }]);
    expect(await db.all("SELECT status, settled_at, posted_at FROM tx WHERE id = 'bk-21'")).toEqual(
      [{ status: 'posted', settled_at: '2026-10-15T08:02:00.000Z', posted_at: NOW }],
    );
    expect(await amount()).toEqual(before);
  });

  test('a refresh that fails posts nothing, and the retry posts everything due', async () => {
    const db = await freshDb();
    await sync(db, settledBank(), options);
    clock.now = LATER;
    const real = settledBank();
    const flaky: Db = {
      all: (sql, params) => db.all(sql, params),
      run: (sql, params) => db.run(sql, params),
      transaction: (work) =>
        db.transaction((tx) =>
          work({
            ...tx,
            run: async (sql, params) => {
              if (sql.startsWith('UPDATE tx SET status')) throw new Error('disk I/O error');
              return tx.run(sql, params);
            },
          }),
        ),
    };

    const offline = await sync(
      db,
      createMockBank({ now: () => clock.now, wait: async () => {} }).under({
        ...NORMAL,
        size: 20,
        next: 'offline',
      }),
      options,
    );
    await expect(sync(flaky, real, options)).rejects.toThrow('disk I/O error');
    const stuck = await board(db);
    await sync(db, real, options);

    expect(offline.ok).toBe(false);
    expect(stuck.map((r) => r.status)).toEqual(['pending', 'pending', 'pending']);
    expect((await board(db)).map((r) => r.status)).toEqual(['posted', 'posted', 'posted']);
  });

  test('a row added on the phone is never touched, even under a bank id', async () => {
    const db = await freshDb();
    await db.run(MANUAL);
    await db.run("UPDATE tx SET status = 'pending' WHERE id = 'm-1'");
    const hostile: BankApi = {
      fetchPage: async () =>
        ok({ items: [], modified: [{ id: 'm-1', settledAt: LATER }], nextSeq: null }),
    };

    await sync(db, hostile, options);

    expect(await db.all("SELECT status, settled_at FROM tx WHERE id = 'm-1'")).toEqual([
      { status: 'pending', settled_at: null },
    ]);
  });

  test('a posting for a row this phone does not hold adds nothing, and a malformed one is counted', async () => {
    const db = await freshDb();
    const odd: BankApi = {
      fetchPage: async () =>
        ok({
          items: [],
          modified: [
            { id: 'bk-gone', settledAt: LATER },
            { id: 'bk-x', settledAt: 'soon' },
          ],
          nextSeq: null,
        }),
    };

    const result = await sync(db, odd, options);

    expect(result).toEqual({ ok: false, error: { kind: 'invalid_data', skipped: 1 } });
    expect(await count(db)).toBe(0);
  });

  test('a posted row is not posted again, so its time stays the first one', async () => {
    const db = await freshDb();
    const bank = settledBank();
    await sync(db, bank, options);
    clock.now = LATER;
    await sync(db, bank, options);
    const first = await board(db);
    clock.now = InstantSchema.parse('2026-10-20T08:00:00.000Z');
    await sync(db, bank, options);

    expect(await board(db)).toEqual(first);
  });

  test('a reset brings the board back pending, and an old posting cannot post it before the next refresh', async () => {
    const db = await freshDb();
    const bank = settledBank();
    await sync(db, bank, options);
    clock.now = LATER;
    await sync(db, bank, options);

    await resetBankRows(db);
    await sync(db, bank, options);

    expect((await board(db)).map((r) => [r.status, r.settled_at])).toEqual([
      ['pending', null],
      ['pending', null],
      ['pending', null],
    ]);
  });
});

test('a bank that re-sends a posted row as pending does not undo the posting', async () => {
  const db = await freshDb();
  const bank = createMockBank({ now: () => LATER, wait: async () => {} }).under({
    ...NORMAL,
    size: 20,
  });
  await sync(db, bank, options);
  await sync(db, bank, options);
  const page = await bank.fetchPage({ since: 0, limit: 20 });
  const tealive = page.ok
    ? (page.data as { items: Record<string, unknown>[] }).items.find((i) => i.id === 'bk-20')
    : null;
  const resend: BankApi = {
    fetchPage: async () =>
      ok({ items: [{ ...tealive, seq: 21, status: 'pending' }], nextSeq: null }),
  };

  await sync(db, resend, options);

  expect(await db.all("SELECT status, settled_at FROM tx WHERE id = 'bk-20'")).toEqual([
    { status: 'posted', settled_at: '2026-10-15T05:17:00.000Z' },
  ]);
});

test('a posting is never dated before the row was authorised', async () => {
  const db = await freshDb();
  await sync(db, mockBank({ size: 20 }), options);
  const early: BankApi = {
    fetchPage: async () =>
      ok({
        items: [],
        modified: [{ id: 'bk-20', settledAt: '2020-01-01T00:00:00.000Z' }],
        nextSeq: null,
      }),
  };

  await sync(db, early, options);

  expect(await db.all("SELECT posted_at, settled_at FROM tx WHERE id = 'bk-20'")).toEqual([
    { posted_at: '2026-10-15T05:15:00.000Z', settled_at: '2026-10-15T05:15:00.000Z' },
  ]);
});
