import { disarmLockout } from '@/features/auth';
import { resetBank } from '@/features/transactions';
import { PREFS, type PrefValue } from '@/models/prefs';
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
    disarmLockout();
  });
}
