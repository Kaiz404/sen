import { useSyncExternalStore } from 'react';

import { readPref, subscribePrefs, writePref } from '@/services/prefs';
import { QK, queryClient } from '@/services/query-client';

import { stepUp, type StepUpResult } from './use-step-up';

const readHidden = () => readPref('hideAmounts');

function subscribeHidden(onChange: () => void): () => void {
  return subscribePrefs((key) => {
    if (key === 'hideAmounts') onChange();
  });
}

/** The saved `hideAmounts` pref (D27). It outlives lock and restart, so every screen reads this, never the session. */
export function useAmountsHidden(): boolean {
  return useSyncExternalStore(subscribeHidden, readHidden);
}

/** Asks for biometrics every time. Only a confirmed check shows amounts. */
export async function showAmounts(): Promise<StepUpResult> {
  const outcome = await stepUp('reveal');
  if (outcome.ok) writePref('hideAmounts', false);
  return outcome;
}

export function hideAmounts(): void {
  writePref('hideAmounts', true);
}

/** Drops the revealed reads whenever the pref says hidden, whoever wrote it, `clearPrefs` included. */
export function dropRevealedOnHide(): () => void {
  return subscribeHidden(() => {
    if (readHidden()) queryClient.removeQueries({ queryKey: QK.revealed });
  });
}
