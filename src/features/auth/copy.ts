import { Platform } from 'react-native';

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
  biometrics: { name: 'biometrics', title: 'Biometrics', icon: 'fingerprint' },
};

export const AMOUNTS_NOTE = 'Amounts stay hidden until you choose to show them.';

/**
 * What the phone calls its non-biometric check. Android's covers a PIN, a pattern or a password, so it says "screen
 * lock" and never "PIN". iOS has only a passcode.
 */
export const credentialName = (): string => (Platform.OS === 'ios' ? 'passcode' : 'screen lock');

export const TIMED_OUT_TEXT = 'The check timed out. Try again.';

/** Why a step-up check refused, for a screen that has nothing of its own to say. Null for a cancel, which is silent. */
export function revealRefusalText(reason: AuthFailure): string | null {
  switch (reason) {
    case 'cancelled':
      return null;
    case 'timedOut':
      return 'The check timed out. Amounts are still hidden. Try again.';
    case 'noLock':
      return `Amounts are still hidden. Set a ${credentialName()} to use Sen.`;
    case 'unavailable':
      return "The check isn't available right now. Try again soon.";
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

export const RESET_COST = 'Your bank history syncs back. Rows you added are erased.';
