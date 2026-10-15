import { DatabaseSync } from 'node:sqlite';

import { createDb, type OpenDb, sqlRow } from '../port';
import { migrate } from '../schema';

export function createNodeDb(): OpenDb {
  const native = new DatabaseSync(':memory:');
  return createDb({
    all: async (sql, params) =>
      native
        .prepare(sql)
        .all(...params)
        .map(sqlRow),
    run: async (sql, params) => ({
      changes: Number(native.prepare(sql).run(...params).changes),
    }),
    close: async () => native.close(),
  });
}

export async function openTestDb(): Promise<OpenDb> {
  const db = createNodeDb();
  await migrate(db);
  return db;
}
