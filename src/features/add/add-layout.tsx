import { randomUUID } from 'expo-crypto';
import { Stack } from 'expo-router';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  use,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { noteDraftDroppedByLock } from '@/features/auth';
import { PrivacyCover } from '@/features/security';
import { type DayKey, malaysiaDay, toInstant } from '@/models/day';

import { type DraftAction, type DraftInput, draftReducer, hasInput, newDraft } from './draft';

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
 * every protected route, drops it. The full screen modal is presented above the root layout, so it carries its
 * own privacy cover.
 */
export function AddLayout(): ReactNode {
  return (
    <DraftProvider start={freshDraft}>
      <DroppedDraftWatch />
      <View style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }} />
        <PrivacyCover />
      </View>
    </DraftProvider>
  );
}

/** When the add flow unmounts under a lock with input typed, History owes a line about the lost draft. */
export function DroppedDraftWatch(): null {
  const { draft } = useDraft();
  const typed = useRef(false);
  useEffect(() => {
    typed.current = hasInput(draft);
  }, [draft]);
  useEffect(
    () => () => {
      if (typed.current) noteDraftDroppedByLock();
    },
    [],
  );
  return null;
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

const styles = StyleSheet.create({ fill: { flex: 1 } });
