import { PREFS, type PrefKey, type PrefValue } from '@/models/prefs';

export function readPref<K extends PrefKey>(key: K): PrefValue<K> {
  return PREFS[key].default;
}

export function writePref<K extends PrefKey>(_key: K, _value: PrefValue<K>): void {}

export function subscribePrefs(_listener: (key: PrefKey) => void): () => void {
  return () => {};
}

export function clearPrefs(): void {}
