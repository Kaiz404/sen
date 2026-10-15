import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { DbSmoke, StubScreen } from '@/features/stub';

export function StatesScreen(): ReactNode {
  const params = useLocalSearchParams<{ screen?: string; state?: string }>();
  if (params.screen === 'db') return <DbSmoke />;
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  return <StubScreen name="STATES" detail={query} />;
}
