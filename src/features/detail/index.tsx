import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

export function DetailScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StubScreen name="DETAIL" detail={id} />;
}
