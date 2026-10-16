import type { AuthFailure, StepUpResult } from '@/features/auth';
import { markArrival } from '@/features/transactions';
import type { Instant } from '@/models/day';
import type { Draft } from '@/models/draft';
import type { TxId } from '@/models/transaction';
import { activity } from '@/services/activity-log';
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

/** The description only. The log never reads an amount. A row that can't be read just goes unlabelled. */
async function labelOf(db: Db, id: TxId): Promise<string | undefined> {
  try {
    return (await getTransaction(db, id))?.description;
  } catch {
    return undefined;
  }
}

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
    const { row, created } = await insertManual(db, draft, now);
    markArrival(row.id);
    if (created) activity.record(db, { code: 'tx.added', label: row.description });
    freshen();
    return { kind: 'saved', id: row.id };
  } catch {
    return { kind: 'failed' };
  }
}

/** Undo inside the toast skips step-up: it only reverts the add the user just authorised. */
export async function undoAdd(db: Db, id: TxId): Promise<boolean> {
  try {
    const label = await labelOf(db, id);
    const undone = (await deleteManual(db, id)) === 'deleted';
    if (undone) activity.record(db, { code: 'tx.undone', of: 'add', label });
    return undone;
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
    if (outcome === 'deleted') activity.record(db, { code: 'tx.deleted', label: row.description });
    freshen();
    return { kind: outcome };
  } catch {
    return { kind: 'failed' };
  }
}

export async function undoDelete(db: Db, id: TxId): Promise<boolean> {
  try {
    const restored = await restoreDeleted(db, id);
    if (restored)
      activity.record(db, { code: 'tx.undone', of: 'delete', label: await labelOf(db, id) });
    return restored;
  } catch {
    return false;
  } finally {
    freshen();
  }
}
