import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { type ReactNode, useEffect } from 'react';

import { logEvent } from '@/services/logger';

import { ErrorView } from './error-view';

export { ErrorView } from './error-view';
export { ERROR_STATES } from './fixtures';

/**
 * The route `ErrorBoundary` export. It never shows `error.message`, which can carry amounts or paths. Back to
 * History replaces the stack, and Lock takes over if the session has locked meanwhile.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps): ReactNode {
  useEffect(() => logEvent('ui.render_error'), []);
  return <ErrorView onRetry={() => void retry()} onHome={() => router.replace('/')} />;
}
