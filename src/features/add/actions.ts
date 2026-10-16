import type { AuthFailure, StepUpResult } from '@/features/auth';
import { markArrival } from '@/features/transactions';
import type { Instant } from '@/models/day';
import type { Draft } from '@/models/draft';
import type { TxId } from '@/models/transaction';
import type { Db } from '@/services/db';
import { QK, queryClient } from '@/services/query-client';
import { deleteManual, getTransaction, insertManual, restoreDeleted } from '@/services/tx-repo';

export type SaveOutcome =
  | { readonly kind: 'saved'; readonly id: TxId }
  | { readonly kind: 'refused'; readonly reason: AuthFailure }
  | { readonly kind: 'failed' };

export type DeleteOutcome =
  | { readonly kind: 'deleted' }
  | { readonly kind: 'refused'; readonly reason: AuthFailure }
  | { readonly kind: 'read_only' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed' };

function freshen(): void {
  void queryClient.invalidateQueries({ queryKey: QK.tx });
}

/** Asks for step-up, then stores the draft. The draft's `idemKey` makes a repeat save return the stored row. */
export async function saveDraft(
  db: Db,
  draft: Draft,
  stepUp: () => Promise<StepUpResult>,
  now: Instant,
): Promise<SaveOutcome> {
  const auth = await stepUp();
  if (!auth.ok) return { kind: 'refused', reason: auth.reason };
  try {
    const { row } = await insertManual(db, draft, now);
    markArrival(row.id);
    freshen();
    return { kind: 'saved', id: row.id };
  } catch {
    return { kind: 'failed' };
  }
}

/** Undo inside the toast skips step-up: it only reverts the add the user just authorised. */
export async function undoAdd(db: Db, id: TxId): Promise<boolean> {
  try {
    return (await deleteManual(db, id)) === 'deleted';
  } catch {
    return false;
  } finally {
    freshen();
  }
}

/** Bank rows are refused before the prompt, so step-up is never asked for a delete that can't happen. */
export async function deleteRow(
  db: Db,
  id: TxId,
  stepUp: () => Promise<StepUpResult>,
): Promise<DeleteOutcome> {
  try {
    const row = await getTransaction(db, id);
    if (row === null) return { kind: 'missing' };
    if (row.source === 'bank') return { kind: 'read_only' };
    const auth = await stepUp();
    if (!auth.ok) return { kind: 'refused', reason: auth.reason };
    const outcome = await deleteManual(db, id);
    freshen();
    return { kind: outcome };
  } catch {
    return { kind: 'failed' };
  }
}

export async function undoDelete(db: Db, id: TxId): Promise<boolean> {
  try {
    return await restoreDeleted(db, id);
  } catch {
    return false;
  } finally {
    freshen();
  }
}
