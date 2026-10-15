export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

export type RunResult = { readonly changes: number };

export interface Db {
  all(sql: string, params?: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /**
   * Root handle: BEGIN IMMEDIATE. A `tx`: SAVEPOINT. Inside `work` use only `tx`. A call on the outer handle
   * queues behind this transaction, so `work` never returns.
   */
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
}

export interface OpenDb extends Db {
  close(): Promise<void>;
}

export interface Driver {
  all(sql: string, params: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  run(sql: string, params: readonly SqlValue[]): Promise<RunResult>;
  close(): Promise<void>;
}

export function sqlRow(raw: Readonly<Record<string, unknown>>): SqlRow {
  const row: Record<string, SqlValue> = {};
  for (const [column, value] of Object.entries(raw)) {
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`Column ${column} holds a ${typeof value}, which Sen never stores.`);
    }
    row[column] = value;
  }
  return row;
}

type Queue = <T>(job: () => Promise<T>) => Promise<T>;

function fifo(): Queue {
  let tail: Promise<unknown> = Promise.resolve();
  return (job) => {
    const next = tail.then(job);
    tail = next.catch(() => undefined);
    return next;
  };
}

function bounds(level: number) {
  if (level === 0)
    return { begin: ['BEGIN IMMEDIATE'], commit: ['COMMIT'], rollback: ['ROLLBACK'] };
  const name = `sp${level}`;
  return {
    begin: [`SAVEPOINT ${name}`],
    commit: [`RELEASE ${name}`],
    rollback: [`ROLLBACK TO ${name}`, `RELEASE ${name}`],
  };
}

async function runEach(driver: Driver, statements: readonly string[]): Promise<void> {
  for (const sql of statements) await driver.run(sql, []);
}

async function transact<T>(
  driver: Driver,
  level: number,
  work: (tx: Db) => Promise<T>,
): Promise<T> {
  const { begin, commit, rollback } = bounds(level);
  await runEach(driver, begin);
  let open = true;
  const tx = handle(driver, level + 1, fifo(), () =>
    open ? null : 'This transaction has ended. Use the handle its caller holds.',
  );
  try {
    const result = await work(tx);
    open = false;
    await runEach(driver, commit);
    return result;
  } catch (error) {
    open = false;
    await runEach(driver, rollback).catch(() => undefined);
    throw error;
  }
}

function handle(driver: Driver, level: number, queue: Queue, refusal: () => string | null): Db {
  const call = <T>(job: () => Promise<T>) =>
    queue(() => {
      const why = refusal();
      return why === null ? job() : Promise.reject(new Error(why));
    });
  return {
    all: (sql, params = []) => call(() => driver.all(sql, params)),
    run: (sql, params = []) => call(() => driver.run(sql, params)),
    transaction: (work) => call(() => transact(driver, level, work)),
  };
}

export function createDb(driver: Driver): OpenDb {
  let closed = false;
  const queue = fifo();
  const root = handle(driver, 0, queue, () => (closed ? 'The database is closed.' : null));
  return {
    ...root,
    close: () =>
      queue(async () => {
        if (closed) return;
        closed = true;
        await driver.close();
      }),
  };
}
