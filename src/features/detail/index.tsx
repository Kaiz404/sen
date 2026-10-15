import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

/** Reads `id` and parses it with `TxIdSchema`. Lane 4a replaces the stub. */
export function DetailScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StubScreen name="DETAIL" detail={id} />;
}
