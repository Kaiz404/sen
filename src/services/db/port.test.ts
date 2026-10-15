import type { Db, OpenDb } from './port';
import { createNodeDb } from './testing/node-adapter';

let db: OpenDb;

beforeEach(async () => {
  db = createNodeDb();
  await db.run('CREATE TABLE t (name TEXT NOT NULL) STRICT');
});
afterEach(() => db.close());

const names = async (on: Db = db) =>
  (await on.all('SELECT name FROM t ORDER BY rowid')).map((row) => row.name);

test('a transaction that resolves commits its writes', async () => {
  const result = await db.transaction(async (tx) => {
    await tx.run('INSERT INTO t VALUES (?)', ['a']);
    await tx.run('INSERT INTO t VALUES (?)', ['b']);
    return 'done';
  });

  expect(result).toBe('done');
  expect(await names()).toEqual(['a', 'b']);
});

test('a transaction that rejects rolls back and rethrows', async () => {
  const failing = db.transaction(async (tx) => {
    await tx.run('INSERT INTO t VALUES (?)', ['a']);
    throw new Error('sync broke');
  });

  await expect(failing).rejects.toThrow('sync broke');
  expect(await names()).toEqual([]);
});

test('a nested savepoint rolls back only its own writes inside a committed transaction', async () => {
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO t VALUES (?)', ['outer-before']);
    const inner = tx.transaction(async (sp) => {
      await sp.run('INSERT INTO t VALUES (?)', ['inner']);
      throw new Error('inner broke');
    });
    await expect(inner).rejects.toThrow('inner broke');
    await tx.run('INSERT INTO t VALUES (?)', ['outer-after']);
  });

  expect(await names()).toEqual(['outer-before', 'outer-after']);
});

test('a root call waits for an open transaction, so it never lands inside it', async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const failing = db.transaction(async (tx) => {
    await tx.run('INSERT INTO t VALUES (?)', ['rolled-back']);
    await gate;
    throw new Error('sync broke');
  });
  const outside = db.run('INSERT INTO t VALUES (?)', ['outside']);
  let outsideDone = false;
  void outside.then(() => {
    outsideDone = true;
  });

  await new Promise((resolve) => setImmediate(resolve));
  expect(outsideDone).toBe(false);

  release();
  await expect(failing).rejects.toThrow('sync broke');
  await outside;
  expect(await names()).toEqual(['outside']);
});

test('a transaction handle used after its scope rejects', async () => {
  let leaked: Db | undefined;
  await db.transaction(async (tx) => {
    leaked = tx;
  });

  await expect(leaked?.run('INSERT INTO t VALUES (?)', ['late'])).rejects.toThrow(
    'This transaction has ended',
  );
  expect(await names()).toEqual([]);
});

test('close waits for queued work, then refuses more', async () => {
  const write = db.run('INSERT INTO t VALUES (?)', ['queued']);
  const reading = names();
  await db.close();

  await expect(write).resolves.toEqual({ changes: 1 });
  await expect(reading).resolves.toEqual(['queued']);
  await expect(db.all('SELECT 1')).rejects.toThrow('The database is closed.');
  await expect(db.close()).resolves.toBeUndefined();
});
