import { logTiming } from './logger';

/** The steps from a passed biometric prompt to History's first paint, in the order they happen. */
export const UNLOCK_MARKS = [
  'unlock.ok',
  'vault.opened',
  'arriving',
  'arrived',
  'history.mounted',
  'history.rows',
  'history.painted',
] as const;

export type UnlockMark = (typeof UNLOCK_MARKS)[number];

let origin: number | null = null;
const seen = new Set<UnlockMark>();

/**
 * Logs how long after `unlock.ok` a step ran, once per unlock. Marks before `unlock.ok` are ignored, so a
 * cold launch, a gallery state and a Jest render log nothing. Dev builds only.
 */
export function mark(name: UnlockMark): void {
  if (!__DEV__) return;
  const now = performance.now();
  if (name === 'unlock.ok') {
    origin = now;
    seen.clear();
  }
  if (origin === null || seen.has(name)) return;
  seen.add(name);
  logTiming(name, now - origin);
}
