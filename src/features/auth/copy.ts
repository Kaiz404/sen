import { capital } from '@/models/text';
import type { StoreCause } from '@/services/store-fault';

import type { AuthFailure, Biometric } from './prompt';
import type { IconName } from './screens/parts';

export type BiometricCopy = {
  readonly name: string;
  readonly title: string;
  readonly icon: IconName;
};

export const BIOMETRIC: Readonly<Record<Biometric, BiometricCopy>> = {
  faceId: { name: 'Face ID', title: 'Face ID', icon: 'face-recognition' },
  touchId: { name: 'Touch ID', title: 'Touch ID', icon: 'fingerprint' },
  face: { name: 'face unlock', title: 'Face unlock', icon: 'face-recognition' },
  fingerprint: { name: 'fingerprint', title: 'Fingerprint', icon: 'fingerprint' },
};

export const AMOUNTS_NOTE = 'Amounts stay hidden until you choose to show them.';

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const timedOutText = (name: string) =>
  `The check timed out. Try ${name} again, or use your device passcode.`;

/** Over the off and weak views, whose keys stay. Only the passcode can be tried again there. */
export const TIMED_OUT_SETUP = 'The check timed out. Try your device passcode again.';

export function triesLeftText(triesLeft: number, name: string): string {
  if (triesLeft === 0) return "Didn't match. Use your device passcode.";
  return `Didn't match. ${triesLeft} more ${triesLeft === 1 ? 'try' : 'tries'} before ${name} locks.`;
}

/** Why a step-up check refused, for a screen that has nothing of its own to say. Null for a cancel, which is silent. */
export function revealRefusalText(reason: AuthFailure, name: string): string | null {
  switch (reason) {
    case 'cancelled':
      return null;
    case 'timedOut':
      return 'The check timed out. Amounts are still hidden. Try again.';
    case 'mismatch':
      return `${capital(name)} didn't match.`;
    case 'lockout':
      return 'Too many tries. Use your device passcode.';
    case 'not_set_up':
      return `${capital(name)} is off. Your device passcode still works.`;
    case 'unavailable':
      return `${capital(name)} isn't available right now. Try again soon.`;
    case 'unknown':
      return 'Something went wrong with the check. Try again.';
  }
}

export const STORE_COPY: Readonly<
  Record<StoreCause, { readonly title: readonly [string, string]; readonly body: string }>
> = {
  full: {
    title: ['Phone is', 'full.'],
    body: 'Your phone is out of space. Free some up, then try again.',
  },
  key: {
    title: ["Can't open", 'its store.'],
    body: "Your phone wouldn't hand over Sen's key. Nothing was shown.",
  },
  store: {
    title: ["Can't open", 'its store.'],
    body: "Sen's data on this phone wouldn't open. Nothing was shown.",
  },
};

export const WEAK_BIOMETRIC = 'Sen needs fingerprint or your passcode on this phone.';

export const RESET_COST = 'Your bank history syncs back. Rows you added are erased.';
