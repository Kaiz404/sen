import { DbKeySchema, DbUnreadableError, openDb } from './expo';

type FakeNative = {
  statements: string[];
  closed: boolean;
};

const mockState: { natives: FakeNative[]; failure: string | null } = {
  natives: [],
  failure: null,
};

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = jest.requireActual<typeof import('node:sqlite')>('node:sqlite');
  return {
    openDatabaseAsync: async () => {
      const real = new DatabaseSync(':memory:');
      const log: FakeNative = { statements: [], closed: false };
      mockState.natives.push(log);
      return {
        execAsync: async (sql: string) => {
          log.statements.push(sql);
          real.exec(sql);
        },
        getAllAsync: async (sql: string, params: (string | number | null)[]) => {
          log.statements.push(sql);
          if (mockState.failure !== null && sql.includes('sqlite_master')) {
            throw new Error(mockState.failure);
          }
          return real.prepare(sql).all(...params);
        },
        runAsync: async (sql: string, params: (string | number | null)[]) => {
          log.statements.push(sql);
          return { changes: Number(real.prepare(sql).run(...params).changes), lastInsertRowId: 0 };
        },
        closeAsync: async () => {
          log.closed = true;
          real.close();
        },
      };
    },
  };
});

const KEY = DbKeySchema.parse('a'.repeat(64));

beforeEach(() => {
  mockState.natives = [];
  mockState.failure = null;
});

test('the key is the first statement, then one read proves it, then the schema migrates', async () => {
  const db = await openDb(KEY);

  const [native] = mockState.natives;
  expect(native?.statements.slice(0, 3)).toEqual([
    `PRAGMA key = "x'${'a'.repeat(64)}'"`,
    'SELECT count(*) FROM sqlite_master',
    'PRAGMA user_version',
  ]);
  expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: 2 }]);
  await db.close();
  expect(native?.closed).toBe(true);
});

test('a key that cannot read the file throws DbUnreadableError and closes the handle', async () => {
  mockState.failure = 'Error code 26: file is not a database';

  await expect(openDb(KEY)).rejects.toBeInstanceOf(DbUnreadableError);
  expect(mockState.natives[0]?.closed).toBe(true);
});

test('a damaged page (code 11) reads as unreadable, so the vault resets instead of looping', async () => {
  mockState.failure = 'Error code 11: database disk image is malformed';

  await expect(openDb(KEY)).rejects.toBeInstanceOf(DbUnreadableError);
  expect(mockState.natives[0]?.closed).toBe(true);
});

test('only 64 hex characters can become a key', () => {
  expect(DbKeySchema.safeParse('0f'.repeat(32)).success).toBe(true);
  expect(DbKeySchema.safeParse('0f'.repeat(31)).success).toBe(false);
  expect(DbKeySchema.safeParse(`${'0'.repeat(62)}'"`).success).toBe(false);
});

test('a busy or failing disk is not mistaken for a wrong key, so nobody resets the file', async () => {
  mockState.failure = 'Error code 5: database is locked';

  await expect(openDb(KEY)).rejects.toThrow('Error code 5: database is locked');
  await expect(openDb(KEY)).rejects.not.toBeInstanceOf(DbUnreadableError);
  expect(mockState.natives[0]?.closed).toBe(true);
});
