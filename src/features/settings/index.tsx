import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';
import type { PrefValue } from '@/models/prefs';
import type { MotionLevel } from '@/motion/policy';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SenMotionPrefIsMotionLevel = Assert<Same<PrefValue<'senMotion'>, MotionLevel>>;

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
