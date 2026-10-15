/** What a bound parameter can be. Positional only: expo-sqlite and node:sqlite name parameters differently. */
export type SqlValue = string | number | null;

/**
 * A row as SQLite returned it, before parsing. Untrusted: callers parse rows with `parseRows`, so one bad
 * row is dropped and counted instead of failing the page.
 */
export type SqlRow = Readonly<Record<string, SqlValue>>;

export type RunResult = { readonly changes: number };

/**
 * The database port. Every service takes a `Db` as its first argument and never holds one at module scope,
 * so the same function runs on the root handle or inside a caller's transaction.
 */
export interface Db {
  all(sql: string, params?: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /**
   * Runs `work` in a transaction on `tx`. It commits if `work` resolves, and rolls back and rethrows if it
   * rejects. On the root handle it is `BEGIN IMMEDIATE`. On a `tx` it is a `SAVEPOINT`, so a helper that
   * opens its own transaction composes inside a caller's.
   * Calls on one handle run in order, one at a time. Inside `work`, use only `tx`: a call on the outer handle
   * waits for `work` to finish, so `work` never returns.
   */
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
}

/** The handle an adapter opens. Only the owner of the session's lifecycle closes it. */
export interface OpenDb extends Db {
  /** Waits for queued work, then closes. Later calls reject. Closing twice is a no-op. */
  close(): Promise<void>;
}

/** What an adapter supplies. All transaction and queueing semantics live in `createDb`. */
export interface Driver {
  all(sql: string, params: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  run(sql: string, params: readonly SqlValue[]): Promise<RunResult>;
  close(): Promise<void>;
}

/** Narrows a driver's raw row to `SqlRow`. A blob or bigint is a schema bug, so it throws. */
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

/** Level 0 is the root transaction. Each nested level is a savepoint named after its depth. */
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
    // The caller needs the error that broke the transaction, not a failure of the cleanup after it.
    await runEach(driver, rollback).catch(() => undefined);
    throw error;
  }
}

/** A handle whose calls run one at a time. `refusal` names why the handle is no longer usable. */
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

/** Wraps a driver in the port. Both adapters share it, so the Jest semantics are the device semantics. */
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
