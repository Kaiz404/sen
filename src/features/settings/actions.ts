import { disarmLockout } from '@/features/auth';
import { resetBank } from '@/features/transactions';
import { PREFS, type PrefValue } from '@/models/prefs';
import type { Db } from '@/services/db';
import { writePref } from '@/services/prefs';

/** Loads the bank's feed at the new size. Rows added on the phone stay. */
export async function switchDataset(db: Db, size: PrefValue<'demo.datasetSize'>): Promise<void> {
  writePref('demo.datasetSize', size);
  await resetBank(db);
}

/** Every reviewer control back to its default, then the sample rows load again. Security choices stay. */
export async function resetDemo(db: Db): Promise<void> {
  writePref('demo.next', PREFS['demo.next'].default);
  writePref('demo.datasetSize', PREFS['demo.datasetSize'].default);
  writePref('demo.slow', PREFS['demo.slow'].default);
  writePref('demo.newOnRefresh', PREFS['demo.newOnRefresh'].default);
  disarmLockout();
  await resetBank(db);
}
