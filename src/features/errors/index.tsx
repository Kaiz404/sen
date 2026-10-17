import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { type ReactNode, useEffect } from 'react';

import { lockNow } from '@/features/auth';
import { logEvent } from '@/services/logger';

import { ErrorView } from './error-view';

export { ErrorView } from './error-view';
export { ERROR_STATES } from './fixtures';

/**
 * The route `ErrorBoundary` export. It never shows `error.message`, which can carry amounts or paths. A caught
 * error locks the session, because the root boundary replaces the layout that runs the idle and background locks,
 * so recovery goes through Lock.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps): ReactNode {
  useEffect(() => {
    logEvent('ui.render_error');
    lockNow();
  }, []);
  return <ErrorView onRetry={() => void retry()} onHome={() => router.replace('/')} />;
}
