import type { StepUpAction } from './machine';
import { authenticate, type AuthOutcome } from './prompt';
import { dispatch, sessionStore } from './session';

export type StepUpResult = AuthOutcome;

const PROMPT: Readonly<Record<StepUpAction, string>> = {
  reveal: 'Show amounts',
  add: 'Save this transaction',
  delete: 'Delete this transaction',
  clearLog: 'Clear security activity',
  erase: 'Erase transactions you added',
};

export async function stepUp(action: StepUpAction): Promise<StepUpResult> {
  const { status } = sessionStore.getState().session;
  if (status !== 'unlocked') return { ok: false, reason: 'cancelled' };
  dispatch({ type: 'STEP_UP_START', action });

  const outcome = await authenticate(PROMPT[action]);
  dispatch({ type: 'STEP_UP_DONE' });
  return outcome;
}

export function useStepUp(action: StepUpAction): () => Promise<StepUpResult> {
  return () => stepUp(action);
}
