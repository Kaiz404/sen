import { getRandomValues } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import {
  type DbKey,
  DbUnreadableError,
  deleteDb,
  type OpenDb,
  openDb,
  SchemaTooNewError,
} from './db';
import { openTestDb } from './db/testing/node-adapter';
import { logEvent } from './logger';
import { createVault, destroyVault, hasVault, openVault, type VaultPorts } from './vault';

jest.mock('./logger');

const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn(async (name: string) => mockKeychain.get(name) ?? null),
  setItemAsync: jest.fn(async (name: string, value: string) => {
    mockKeychain.set(name, value);
  }),
  deleteItemAsync: jest.fn(async (name: string) => {
    mockKeychain.delete(name);
  }),
}));
const mockDisk = new Set<string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents/' },
  File: jest.fn((...parts: string[]) => ({
    get exists() {
      return mockDisk.has(parts.join('|'));
    },
  })),
}));
jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((bytes: Uint8Array) => {
    bytes.forEach((_, i) => (bytes[i] = i));
    return bytes;
  }),
}));
jest.mock('./db', () => ({
  ...jest.requireActual('./db'),
  openDb: jest.fn(),
  deleteDb: jest.fn(),
}));

const K = 'c'.repeat(64);
const K2 = 'd'.repeat(64);
const NEW = 'a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf';

type DbFile = { key: string; version: number; generation: number };

const handles: OpenDb[] = [];
afterEach(async () => {
  await Promise.all(handles.splice(0).map((db) => db.close()));
  jest.clearAllMocks();
});

function device(start: { key: string | null; file: Omit<DbFile, 'generation'> | null }) {
  const state = {
    key: start.key,
    file: start.file && { ...start.file, generation: 1 },
    files: 1,
    busy: false,
    failKeyWrite: false,
    prefsCleared: 0,
    closed: 0,
  };
  const ports: VaultPorts = {
    keys: {
      read: async () => state.key,
      write: async (key) => {
        if (state.failKeyWrite) throw new Error('keystore unavailable');
        state.key = key;
      },
      remove: async () => {
        state.key = null;
      },
    },
    database: {
      open: async (key: DbKey) => {
        if (state.busy) throw new Error('Error code 5: database is locked');
        if (state.file === null) state.file = { key, version: 1, generation: ++state.files };
        if (state.file.key !== key)
          throw new DbUnreadableError({ cause: new Error('Error code 26') });
        if (state.file.version > 1) throw new SchemaTooNewError(state.file.version);
        const db = await openTestDb();
        handles.push(db);
        return {
          ...db,
          close: async () => {
            state.closed++;
          },
        };
      },
      remove: async () => {
        state.file = null;
      },
      exists: () => state.file !== null,
    },
    randomBytes: (length) => Uint8Array.from({ length }, (_, i) => 0xa0 + i),
    clearPrefs: () => {
      state.prefsCleared++;
    },
  };
  return { state, vault: createVault(ports) };
}

describe('the reset rules', () => {
  test.each([
    ['first run', null, null, { kind: 'created' }, NEW, { key: NEW, version: 1, generation: 2 }],
    [
      'a key left by an old install, no file',
      K,
      null,
      { kind: 'created' },
      NEW,
      { key: NEW, version: 1, generation: 2 },
    ],
    [
      'unlock',
      K,
      { key: K, version: 1 },
      { kind: 'opened' },
      K,
      { key: K, version: 1, generation: 1 },
    ],
    [
      'backup restore: file, no key',
      null,
      { key: K2, version: 1 },
      { kind: 'reset', reason: 'missing_key' },
      NEW,
      { key: NEW, version: 1, generation: 2 },
    ],
    [
      'a stored key that is not 64 hex',
      'not-a-key',
      { key: K2, version: 1 },
      { kind: 'reset', reason: 'missing_key' },
      NEW,
      { key: NEW, version: 1, generation: 2 },
    ],
    [
      'a key that cannot read the file',
      K,
      { key: K2, version: 1 },
      { kind: 'reset', reason: 'corrupt' },
      K,
      { key: K, version: 1, generation: 2 },
    ],
    [
      'a schema newer than the app',
      K,
      { key: K, version: 7 },
      { kind: 'reset', reason: 'corrupt' },
      K,
      { key: K, version: 1, generation: 2 },
    ],
  ] as const)('%s', async (_, key, file, outcome, keyAfter, fileAfter) => {
    const { state, vault } = device({ key, file });

    const opened = await vault.openVault();

    expect({ kind: opened.kind, ...('reason' in opened && { reason: opened.reason }) }).toEqual(
      outcome,
    );
    expect(await opened.db.all('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
    expect([state.key, state.file]).toEqual([keyAfter, fileAfter]);
    expect(jest.mocked(logEvent).mock.calls).toEqual([
      [outcome.kind === 'reset' ? `vault.reset.${outcome.reason}` : `vault.${outcome.kind}`],
    ]);
  });

  test.each([
    ['a stored key', K, { key: K, version: 1 }],
    ['no key', null, { key: K2, version: 1 }],
  ])('a busy disk with %s rethrows and wipes nothing', async (_, key, file) => {
    const { state, vault } = device({ key, file });
    state.busy = true;

    await expect(vault.openVault()).rejects.toThrow('Error code 5: database is locked');
    expect([state.key, state.file]).toEqual([key, { ...file, generation: 1 }]);
  });

  test('a new key that cannot be stored closes the database and leaves no key', async () => {
    const { state, vault } = device({ key: null, file: null });
    state.failKeyWrite = true;

    await expect(vault.openVault()).rejects.toThrow('keystore unavailable');
    expect([state.key, state.closed]).toEqual([null, 1]);
  });

  test.each([
    ['no key, no file', null, null, false, null],
    [
      'a key that is not 64 hex, and its file',
      'not-a-key',
      { key: K, version: 1 },
      false,
      'not-a-key',
    ],
    ['a 64-hex key and its file', K, { key: K, version: 1 }, true, K],
    ['a file with no key', null, { key: K, version: 1 }, false, null],
    ['a key with no file, as after an iOS reinstall', K, null, false, null],
  ] as const)('hasVault with %s', async (_, key, file, answer, keyAfter) => {
    const { state, vault } = device({ key, file });

    expect(await vault.hasVault()).toBe(answer);
    expect(state.key).toBe(keyAfter);
  });

  test('destroyVault deletes the key and the file and clears prefs, and can run twice', async () => {
    const { state, vault } = device({ key: K, file: { key: K, version: 1 } });

    await vault.destroyVault();
    await vault.destroyVault();

    expect([state.key, state.file, state.prefsCleared]).toEqual([null, null, 2]);
    expect(await vault.hasVault()).toBe(false);
  });
});

describe('on the device ports', () => {
  const OPTIONS = { keychainAccessible: 6 };
  const KEY = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');

  const SEN_DB = [Paths.document, 'SQLite', 'sen.db'].join('|');

  beforeEach(() => {
    mockKeychain.clear();
    mockDisk.clear();
    jest.mocked(openDb).mockImplementation(async () => {
      mockDisk.add(SEN_DB);
      const db = await openTestDb();
      handles.push(db);
      return db;
    });
    jest.mocked(deleteDb).mockImplementation(async () => {
      mockDisk.delete(SEN_DB);
    });
  });

  test('the first open stores 32 random bytes as 64 hex under sen.dbKey.v1, unlocked-only, no biometrics', async () => {
    const opened = await openVault();

    expect(opened.kind).toBe('created');
    expect(jest.mocked(getRandomValues).mock.calls.map(([bytes]) => bytes.length)).toEqual([32]);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls).toEqual([
      ['sen.dbKey.v1', KEY, OPTIONS],
    ]);
    expect(jest.mocked(openDb).mock.calls).toEqual([[KEY]]);
  });

  test('the next open reads that key with the same options', async () => {
    await openVault();
    jest.clearAllMocks();

    const opened = await openVault();

    expect([opened.kind, await hasVault()]).toEqual(['opened', true]);
    expect(jest.mocked(SecureStore.getItemAsync).mock.calls[0]).toEqual(['sen.dbKey.v1', OPTIONS]);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls).toEqual([]);
    expect(jest.mocked(openDb).mock.calls).toEqual([[KEY]]);
  });

  test('destroyVault deletes the key and the file, and a file already gone is fine', async () => {
    await openVault();
    jest.mocked(deleteDb).mockRejectedValueOnce(new Error("Database '/data/sen.db' not found"));

    await destroyVault();

    expect(jest.mocked(SecureStore.deleteItemAsync).mock.calls).toEqual([
      ['sen.dbKey.v1', OPTIONS],
    ]);
    expect(jest.mocked(deleteDb).mock.calls).toEqual([[]]);
    expect(await hasVault()).toBe(false);
  });

  test('a file that is still open is not silently kept', async () => {
    jest
      .mocked(deleteDb)
      .mockRejectedValueOnce(
        new Error("Unable to delete database 'sen.db' that is currently open."),
      );

    await expect(destroyVault()).rejects.toThrow('currently open');
  });

  test('a key that outlived its database file, as after an iOS reinstall, is deleted', async () => {
    mockKeychain.set('sen.dbKey.v1', KEY);

    expect(await hasVault()).toBe(false);

    expect(mockKeychain.has('sen.dbKey.v1')).toBe(false);
    expect(jest.mocked(File).mock.calls).toEqual([[Paths.document, 'SQLite', 'sen.db']]);
  });
  test('a file check that throws keeps the key, so a bad check never deletes data', async () => {
    mockKeychain.set('sen.dbKey.v1', KEY);
    jest.mocked(File).mockImplementationOnce(() => {
      throw new Error('FileSystem is not available');
    });

    expect(await hasVault()).toBe(true);
    expect(mockKeychain.get('sen.dbKey.v1')).toBe(KEY);
  });
});
