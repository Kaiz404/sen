import type { AuthFailure, StepUpResult } from '@/features/auth';

export type EraseOutcome =
  | { readonly kind: 'erased' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> }
  | { readonly kind: 'failed' };

/**
 * Step-up first, then the wipe. The wipe is sign-out's: it closes the database, deletes the vault key, the file
 * and every pref, and shows Welcome. A cancel changes nothing. A wipe that fails has already moved the session to
 * Lock, whose "Start again" runs the same wipe once more.
 */
export async function eraseEverything(
  confirm: () => Promise<StepUpResult>,
  wipe: () => Promise<void>,
): Promise<EraseOutcome> {
  const auth = await confirm();
  if (!auth.ok) {
    return auth.reason === 'cancelled'
      ? { kind: 'cancelled' }
      : { kind: 'refused', reason: auth.reason };
  }
  try {
    await wipe();
    return { kind: 'erased' };
  } catch {
    return { kind: 'failed' };
  }
}
