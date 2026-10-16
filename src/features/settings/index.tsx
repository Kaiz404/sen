import type { PrefValue } from '@/models/prefs';
import type { MotionLevel } from '@/motion/policy';

import { usePref } from './use-pref';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SenMotionPrefIsMotionLevel = Assert<Same<PrefValue<'senMotion'>, MotionLevel>>;

/** The "Sen's animations" setting, live. The root layout hands it to `MotionPolicyRoot`. */
export function useSenMotionPreference(): MotionLevel {
  return usePref('senMotion');
}

export { SETTINGS_STATES } from './fixtures';
export { SettingsScreen } from './settings-screen';
export { PrivacySheet, ResetDemoSheet, SignOutSheet } from './sheets';
