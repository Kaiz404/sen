import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { DbSmoke, StubScreen } from '@/features/stub';

/**
 * The dev states gallery behind `sen://dev/states?screen=&state=` and `?screen=sen&pose=&size=`. It renders
 * feature screens from fixtures, so it lives in features. Lane 2a fills it. Phase 1 serves the database
 * smoke at `screen=db` and echoes every other query.
 */
export function StatesScreen(): ReactNode {
  const params = useLocalSearchParams<{ screen?: string; state?: string }>();
  if (params.screen === 'db') return <DbSmoke />;
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  return <StubScreen name="STATES" detail={query} />;
}
