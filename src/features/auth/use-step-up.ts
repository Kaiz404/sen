import type { StepUpAction } from './machine';
import type { AuthOutcome } from './prompt';
import { check, dispatch, sessionStore } from './session';

export type StepUpResult = AuthOutcome;

const PROMPT: Readonly<Record<StepUpAction, string>> = {
  reveal: 'Show amounts',
  add: 'Save this transaction',
  delete: 'Delete this transaction',
  clearLog: 'Clear security activity',
  erase: 'Erase transactions I added',
};

const CANCELLED: StepUpResult = { ok: false, reason: 'cancelled' };

/** Every write asks through `check`, the same single route Unlock takes (D40). */
export async function stepUp(action: StepUpAction): Promise<StepUpResult> {
  const { status } = sessionStore.getState().session;
  if (status !== 'unlocked') return CANCELLED;
  dispatch({ type: 'STEP_UP_START', action });

  const outcome = await check(PROMPT[action]);
  dispatch({ type: 'STEP_UP_DONE' });
  if (sessionStore.getState().session.status !== 'unlocked') return CANCELLED;
  return outcome;
}

export function useStepUp(action: StepUpAction): () => Promise<StepUpResult> {
  return () => stepUp(action);
}
