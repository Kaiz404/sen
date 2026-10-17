import { createMMKV, type MMKV } from 'react-native-mmkv';

import {
  type BankState,
  BankStateSchema,
  NO_BANK_STATE,
  parsePref,
  PREFS,
  type PrefKey,
  type PrefValue,
} from '@/models/prefs';

let store: MMKV | null = null;

function prefs(): MMKV {
  store ??= createMMKV({ id: 'prefs' });
  return store;
}

const isPrefKey = (key: string): key is PrefKey => key in PREFS;
const KEYS = Object.keys(PREFS).filter(isPrefKey);

const listeners = new Set<(key: PrefKey) => void>();

function notify(key: PrefKey): void {
  for (const listener of listeners) listener(key);
}

function decode(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Never throws. A missing or corrupt value reads as the documented default. */
export function readPref<K extends PrefKey>(key: K): PrefValue<K> {
  return parsePref(key, decode(prefs().getString(key)));
}

export function writePref<K extends PrefKey>(key: K, value: PrefValue<K>): void {
  prefs().set(key, JSON.stringify(value));
  notify(key);
}

const BANK_STATE_KEY = 'bank.state';

/** What the mock bank remembers. Not a setting, so it is not a `PrefKey`, but it shares the store and `clearPrefs`. */
export function readBankState(): BankState {
  const parsed = BankStateSchema.safeParse(decode(prefs().getString(BANK_STATE_KEY)));
  return parsed.success ? parsed.data : NO_BANK_STATE;
}

export function writeBankState(state: BankState): void {
  prefs().set(BANK_STATE_KEY, JSON.stringify(state));
}

/** Called with the key after every write, and with every key after `clearPrefs`. */
export function subscribePrefs(listener: (key: PrefKey) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearPrefs(): void {
  prefs().clearAll();
  KEYS.forEach(notify);
}
