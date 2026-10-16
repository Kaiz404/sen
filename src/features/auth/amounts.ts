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

export function useAmountsHidden(): boolean {
  return useSyncExternalStore(subscribeHidden, readHidden);
}

export async function showAmounts(): Promise<StepUpResult> {
  const outcome = await stepUp('reveal');
  if (outcome.ok) writePref('hideAmounts', false);
  return outcome;
}

export function hideAmounts(): void {
  writePref('hideAmounts', true);
}

export function dropRevealedOnHide(): () => void {
  return subscribeHidden(() => {
    if (readHidden()) queryClient.removeQueries({ queryKey: QK.revealed });
  });
}
