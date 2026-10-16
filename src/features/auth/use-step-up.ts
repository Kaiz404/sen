import type { StepUpAction } from './machine';
import { authenticate, type AuthOutcome } from './prompt';
import { dispatch, noteFailedCheck, sessionStore } from './session';

export type StepUpResult = AuthOutcome;

const PROMPT: Readonly<Record<StepUpAction, string>> = {
  reveal: 'Show amounts',
  add: 'Save this transaction',
  delete: 'Delete this transaction',
  clearLog: 'Clear security activity',
  erase: 'Erase everything on this phone',
};

const CANCELLED: StepUpResult = { ok: false, reason: 'cancelled' };

export async function stepUp(action: StepUpAction): Promise<StepUpResult> {
  const { status } = sessionStore.getState().session;
  if (status !== 'unlocked') return CANCELLED;
  dispatch({ type: 'STEP_UP_START', action });

  const outcome = await authenticate(PROMPT[action]);
  dispatch({ type: 'STEP_UP_DONE' });
  if (sessionStore.getState().session.status !== 'unlocked') return CANCELLED;
  noteFailedCheck(outcome);
  return outcome;
}

export function useStepUp(action: StepUpAction): () => Promise<StepUpResult> {
  return () => stepUp(action);
}
