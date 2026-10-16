import { useSyncExternalStore } from 'react';

import type { PrefKey, PrefValue } from '@/models/prefs';
import { readPref, subscribePrefs } from '@/services/prefs';

/** One pref, re-rendered on every write from anywhere, `clearPrefs` included. */
export function usePref<K extends PrefKey>(key: K): PrefValue<K> {
  return useSyncExternalStore(
    (onChange) =>
      subscribePrefs((changed) => {
        if (changed === key) onChange();
      }),
    () => readPref(key),
  );
}
