import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

import { PrivacyCoverView } from './privacy-cover';

export { PrivacyCover } from './privacy-cover';
export { useScreenGuard } from './screen-guard';

export function EraseSheet(): ReactNode {
  return <StubScreen name="ERASE" />;
}

export const SECURITY_STATES = {
  'privacy-cover': () => <PrivacyCoverView />,
} satisfies Record<string, () => ReactNode>;
