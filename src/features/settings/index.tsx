import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';
import type { PrefValue } from '@/models/prefs';
import type { MotionLevel } from '@/motion/policy';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
/** Fails `tsc` if the stored "Sen's animations" values drift from the motion levels. */
export type SenMotionPrefIsMotionLevel = Assert<Same<PrefValue<'senMotion'>, MotionLevel>>;

/**
 * The "Sen's animations" setting, read synchronously from prefs so the first frame is already right.
 * Motion can't import services, so the root layout reads it here and passes it to `<MotionPolicyRoot>`.
 * Lane 4c reads `senMotion` through the prefs service and subscribes to changes.
 */
export function useSenMotionPreference(): MotionLevel {
  return 'full';
}

export function SettingsScreen(): ReactNode {
  return <StubScreen name="SETTINGS" />;
}

export function PrivacySheet(): ReactNode {
  return <StubScreen name="PRIVACY" />;
}

export function SignOutSheet(): ReactNode {
  return <StubScreen name="SIGN OUT" />;
}

export function ResetDemoSheet(): ReactNode {
  return <StubScreen name="RESET DEMO" />;
}
