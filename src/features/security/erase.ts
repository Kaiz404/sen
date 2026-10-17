import type { AuthFailure, StepUpResult } from '@/features/auth';
import { activity } from '@/services/activity-log';
import type { Db } from '@/services/db';
import { QK, queryClient } from '@/services/query-client';
import { eraseManual } from '@/services/tx-repo';

export type EraseOutcome =
  | { readonly kind: 'erased'; readonly count: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> }
  | { readonly kind: 'failed' };

/**
 * Step-up first, then every row added on this phone goes in one transaction. The vault, key, prefs and bank rows
 * stay. A cancel or a refusal changes nothing, and so does a delete that fails. The log records how many rows
 * went, never what they held.
 */
export async function eraseAdded(
  db: Db,
  confirm: () => Promise<StepUpResult>,
): Promise<EraseOutcome> {
  const auth = await confirm();
  if (!auth.ok) {
    return auth.reason === 'cancelled'
      ? { kind: 'cancelled' }
      : { kind: 'refused', reason: auth.reason };
  }
  try {
    const count = await eraseManual(db);
    if (count === 0) return { kind: 'empty' };
    activity.record(db, { code: 'tx.erased', count });
    return { kind: 'erased', count };
  } catch {
    return { kind: 'failed' };
  } finally {
    void queryClient.invalidateQueries({ queryKey: QK.tx });
  }
}
