import type { IconName } from '@/components/key';
import type { Biometric } from '@/features/auth';
import type { PrefValue } from '@/models/prefs';
import type { MotionLevel } from '@/motion/policy';

/** One option of a setting: the stored value and what the screen calls it. */
export type Choice<V> = { readonly id: V; readonly label: string };

export const IDLE_CHOICES: readonly Choice<PrefValue<'idleLock'>>[] = [
  { id: 2, label: '2 min' },
  { id: 5, label: '5 min' },
  { id: 10, label: '10 min' },
];

export const RELOCK_CHOICES: readonly Choice<PrefValue<'relockAfter'>>[] = [
  { id: 0, label: 'Right away' },
  { id: 1, label: '1 min' },
  { id: 5, label: '5 min' },
];

export const MOTION_CHOICES: readonly (Choice<MotionLevel> & { readonly blurb: string })[] = [
  { id: 'full', label: 'Full', blurb: 'Hops, flips and waves on the big moments.' },
  { id: 'calm', label: 'Calm', blurb: 'Blinks and face slides only.' },
  { id: 'off', label: 'Off', blurb: 'A still Sen. Nothing moves.' },
];

export const NEXT_CHOICES: readonly Choice<PrefValue<'demo.next'>>[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'offline', label: 'Offline' },
  { id: 'timeout', label: 'Timeout (8 s)' },
  { id: 'server', label: 'Server error 500' },
  { id: 'bad_data', label: 'Bad data' },
];

export const DATASET_CHOICES: readonly Choice<PrefValue<'demo.datasetSize'>>[] = [
  { id: 20, label: '20' },
  { id: 1000, label: '1k' },
  { id: 10000, label: '10k' },
];

/** As it reads mid-sentence. `capital` starts a sentence with it. */
export const BIOMETRIC_NAME: Readonly<Record<Biometric, string>> = {
  faceId: 'Face ID',
  touchId: 'Touch ID',
  face: 'face unlock',
  fingerprint: 'fingerprint',
};

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const BIOMETRIC_ICON: Readonly<Record<Biometric, IconName>> = {
  faceId: 'face-recognition',
  touchId: 'fingerprint',
  face: 'face-recognition',
  fingerprint: 'fingerprint',
};

const count = new Intl.NumberFormat('en-MY');

/** The dataset row's second line, which turns into the load's progress while a sync runs. */
export function datasetLine(progress: { received: number; total: number | null } | null): string {
  if (progress === null) return 'Reloads the bank rows. Rows you added stay.';
  if (progress.total === null) return 'Syncing…';
  return `Loading ${count.format(progress.received)} of ${count.format(progress.total)} rows…`;
}
