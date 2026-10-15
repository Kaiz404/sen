import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

/**
 * App-wide screen protection, called once by the root layout. Off in dev builds, forced on in release, with
 * a test that proves the release config. Phase 5 fills it.
 */
export function useScreenGuard(): void {}

/** "Erase transactions I added": confirm, step-up, delete manual rows, log it. Phase 5. */
export function EraseSheet(): ReactNode {
  return <StubScreen name="ERASE" />;
}
