import { useStore } from 'zustand';

import { QK, queryClient } from '@/services/query-client';

import { recordActivity, sessionStore } from './session';
import { stepUp, type StepUpResult } from './use-step-up';

export function useAmountsHidden(): boolean {
  return useStore(sessionStore, (s) => s.amountsHidden);
}

export async function showAmounts(): Promise<StepUpResult> {
  const outcome = await stepUp('reveal');
  if (outcome.ok) {
    sessionStore.setState({ amountsHidden: false });
    recordActivity({ code: 'amounts.revealed' });
  }
  return outcome;
}

export function hideAmounts(): void {
  const wasShowing = !sessionStore.getState().amountsHidden;
  sessionStore.setState({ amountsHidden: true });
  if (wasShowing) recordActivity({ code: 'amounts.hidden' });
}

export function dropRevealedOnHide(): () => void {
  return sessionStore.subscribe((state, prev) => {
    if (state.amountsHidden && !prev.amountsHidden) {
      queryClient.removeQueries({ queryKey: QK.revealed });
    }
  });
}
