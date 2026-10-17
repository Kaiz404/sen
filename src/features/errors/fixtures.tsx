import type { ReactNode } from 'react';

import { ErrorView } from './error-view';

const noop = () => {};

export const ERROR_STATES = {
  'render-error': () => <ErrorView onRetry={noop} onHome={noop} />,
} satisfies Record<string, () => ReactNode>;
