import { logTiming, type UnlockMark } from './logger';

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
