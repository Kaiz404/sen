import type { StepUpAction } from './machine';
import { type AuthFailure, authenticate, type AuthOutcome } from './prompt';
import { dispatch, noteFailedCheck, sessionStore } from './session';

export type StepUpResult = AuthOutcome;

const PROMPT: Readonly<Record<StepUpAction, string>> = {
  reveal: 'Show amounts',
  add: 'Save this transaction',
  delete: 'Delete this transaction',
  clearLog: 'Clear security activity',
  erase: 'Erase transactions I added',
};

const CANCELLED: StepUpResult = { ok: false, reason: 'cancelled' };

/**
 * Where the sensor cannot answer, the screen lock does, in the same step-up (D40): it is locked out, off, absent, or
 * the user chose the system's own screen-lock button (iOS, handled inside `authenticate`). Anything else is the
 * user's answer, so a cancel, a miss or a timeout is not turned into another prompt.
 */
const SENSOR_CANNOT_ANSWER: ReadonlySet<AuthFailure> = new Set(['lockout', 'not_set_up', 'unavailable']);

/** The sensor first, then the screen lock when the sensor cannot answer. A locked-out sensor is still logged. */
async function check(prompt: string): Promise<AuthOutcome> {
  const first = await authenticate(prompt, 'biometric');
  if (first.ok || !SENSOR_CANNOT_ANSWER.has(first.reason)) return first;
  noteFailedCheck(first);
  return authenticate(prompt, 'credential');
}

export async function stepUp(action: StepUpAction): Promise<StepUpResult> {
  const { status } = sessionStore.getState().session;
  if (status !== 'unlocked') return CANCELLED;
  dispatch({ type: 'STEP_UP_START', action });

  const outcome = await check(PROMPT[action]);
  dispatch({ type: 'STEP_UP_DONE' });
  if (sessionStore.getState().session.status !== 'unlocked') return CANCELLED;
  noteFailedCheck(outcome);
  return outcome;
}

export function useStepUp(action: StepUpAction): () => Promise<StepUpResult> {
  return () => stepUp(action);
}
