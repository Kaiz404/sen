import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';

import { type DraftInput, hasInput } from './draft';

/**
 * Close asks before it drops a draft with input. Android's back key on the first step closes the flow, so it
 * asks too.
 */
export function useCloseGuard(draft: DraftInput, guardBackKey: boolean) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);
  const dirty = hasInput(draft);
  const exit = () => router.dismissTo('/');

  useFocusEffect(
    useCallback(() => {
      if (!guardBackKey || !dirty) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setDiscarding(true);
        return true;
      });
      return () => sub.remove();
    }, [guardBackKey, dirty]),
  );

  return {
    discarding,
    close: () => (dirty ? setDiscarding(true) : exit()),
    discard: exit,
    keep: () => setDiscarding(false),
  };
}
