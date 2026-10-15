import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

export function useScreenGuard(): void {}

export function EraseSheet(): ReactNode {
  return <StubScreen name="ERASE" />;
}
