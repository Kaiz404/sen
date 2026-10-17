import { Platform } from 'react-native';

import { capital } from '@/models/text';
import type { StoreCause } from '@/services/store-fault';

import type { AuthFailure, Biometric } from './prompt';
import type { IconName } from './screens/parts';

export type BiometricCopy = {
  readonly name: string;
  readonly title: string;
  /** The verb that follows the title: "Fingerprint is off", "Biometrics are off". */
  readonly is: 'is' | 'are';
  readonly icon: IconName;
};

export const BIOMETRIC: Readonly<Record<Biometric, BiometricCopy>> = {
  faceId: { name: 'Face ID', title: 'Face ID', is: 'is', icon: 'face-recognition' },
  touchId: { name: 'Touch ID', title: 'Touch ID', is: 'is', icon: 'fingerprint' },
  face: { name: 'face unlock', title: 'Face unlock', is: 'is', icon: 'face-recognition' },
  fingerprint: { name: 'fingerprint', title: 'Fingerprint', is: 'is', icon: 'fingerprint' },
  biometrics: { name: 'biometrics', title: 'Biometrics', is: 'are', icon: 'fingerprint' },
};

export const AMOUNTS_NOTE = 'Amounts stay hidden until you choose to show them.';

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * What the phone calls its non-biometric check. Android's covers a PIN, a pattern or a password, so it says "screen
 * lock" and never "PIN". iOS has only a passcode.
 */
export const credentialName = (): string => (Platform.OS === 'ios' ? 'passcode' : 'screen lock');

/** The key that opens it. */
export const credentialKeyLabel = (): string => `Use ${credentialName()}`;

export const timedOutText = (name: string) =>
  `The check timed out. Try ${name} again, or use your ${credentialName()}.`;

/** Over the off and weak views, whose keys stay. Only the screen lock can be tried again there. */
export const timedOutSetupText = () =>
  `The check timed out. Try your ${credentialName()} again.`;

/**
 * Android never reports a single miss and iOS reports one only when the system gives up, so no count of tries left
 * is known and none is promised.
 */
export const missText = (name: string) =>
  `Didn't match. Try ${name} again, or use your ${credentialName()}.`;

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
      return `Too many tries. Use your ${credentialName()}.`;
    case 'noLock':
      return 'Amounts are still hidden. Set a screen lock to use Sen.';
    case 'not_set_up':
      return `${capital(name)} is off. Your ${credentialName()} still works.`;
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

/** Android only. A weak biometric is a Class 2 one, such as a camera face unlock, and the phone may have no other. */
export const WEAK_BIOMETRIC = "This phone's biometrics are too weak for Sen. Use your screen lock.";

export const RESET_COST = 'Your bank history syncs back. Rows you added are erased.';
