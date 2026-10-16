import { randomUUID } from 'expo-crypto';
import { Stack } from 'expo-router';
import { createContext, type Dispatch, type ReactNode, use, useReducer } from 'react';

import { type DayKey, malaysiaDay, toInstant } from '@/models/day';

import { type DraftAction, type DraftInput, draftReducer, newDraft } from './draft';

type DraftContextValue = {
  readonly draft: DraftInput;
  readonly dispatch: Dispatch<DraftAction>;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function todayInMalaysia(): DayKey {
  return malaysiaDay(toInstant(new Date()));
}

/**
 * Holds the draft for the three add steps. It lives only in this component's state, so the lock, which unmounts
 * every protected route, drops it.
 */
export function AddLayout(): ReactNode {
  return (
    <DraftProvider start={freshDraft}>
      <Stack screenOptions={{ headerShown: false }} />
    </DraftProvider>
  );
}

function freshDraft(): DraftInput {
  return newDraft(randomUUID(), todayInMalaysia());
}

export function DraftProvider({
  start,
  children,
}: {
  readonly start: () => DraftInput;
  readonly children: ReactNode;
}): ReactNode {
  const [draft, dispatch] = useReducer(draftReducer, undefined, start);
  return <DraftContext value={{ draft, dispatch }}>{children}</DraftContext>;
}

export function useDraft(): DraftContextValue {
  const value = use(DraftContext);
  if (value === null) throw new Error('The add steps render inside AddLayout.');
  return value;
}
