import { DRAFT_LIMITS } from '@/models/draft';

export const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const;
export type PadKey = (typeof PAD_KEYS)[number];

const CAP = 10 ** DRAFT_LIMITS.keypadDigits;

/**
 * The amount in sen after one key. Digits shift in from the right like an ATM, so 4, 2, 5, 0 is RM 42.50.
 * A key that would make an eighth digit does nothing, and 00 never adds just one of its zeros.
 */
export function pressKey(sen: number, key: PadKey): number {
  if (key === 'back') return Math.floor(sen / 10);
  const next = Number(`${sen}${key}`);
  return next < CAP ? next : sen;
}
