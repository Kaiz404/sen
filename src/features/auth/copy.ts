import type { Biometric } from './prompt';
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

export function amountsNote(hidden: boolean): string {
  return hidden
    ? 'Amounts stay hidden until you choose to show them.'
    : 'Amounts show after you unlock, until you hide them.';
}

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function triesLeftText(triesLeft: number, name: string): string {
  if (triesLeft === 0) return "Didn't match. Use your device passcode.";
  return `Didn't match. ${triesLeft} more ${triesLeft === 1 ? 'try' : 'tries'} before ${name} locks.`;
}
