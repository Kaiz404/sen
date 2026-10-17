import { resetBank } from '@/features/transactions';
import type { ActivityEvent } from '@/models/activity';
import { PREFS, type PrefKey, type PrefValue } from '@/models/prefs';
import { activity } from '@/services/activity-log';
import type { Db } from '@/services/db';
import { writePref } from '@/services/prefs';

/** Loads the bank's feed at the new size. Rows added on the phone stay. A failed reset keeps the old size. */
export async function switchDataset(db: Db, size: PrefValue<'demo.datasetSize'>): Promise<void> {
  await resetBank(db, () => writePref('demo.datasetSize', size));
}

/**
 * Every reviewer control back to its default, then the sample rows load again. Security choices stay.
 * A failed reset changes nothing, as its sheet says.
 */
export async function resetDemo(db: Db): Promise<void> {
  await resetBank(db, () => {
    writePref('demo.next', PREFS['demo.next'].default);
    writePref('demo.datasetSize', PREFS['demo.datasetSize'].default);
    writePref('demo.slow', PREFS['demo.slow'].default);
    writePref('demo.newOnRefresh', PREFS['demo.newOnRefresh'].default);
  });
  activity.record(db, { code: 'demo.reset' });
}

/** A longer idle or leave-time window leaves the phone open for longer, so it is a security event. */
export function weakening(key: PrefKey, from: unknown, to: unknown): ActivityEvent | null {
  if ((key !== 'idleLock' && key !== 'relockAfter') || typeof from !== 'number') return null;
  if (typeof to !== 'number' || to <= from) return null;
  const parsed = PREFS[key].schema.safeParse(to);
  return parsed.success ? { code: 'settings.weakened', setting: key, minutes: parsed.data } : null;
}
