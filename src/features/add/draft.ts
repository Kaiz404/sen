import type { AddCategoryId } from '@/models/category';
import type { DayKey } from '@/models/day';
import { type Draft, DRAFT_LIMITS, draftSchema } from '@/models/draft';
import type { Direction } from '@/models/money';
import { sanitizeDescription } from '@/services/sanitize';

import { type PadKey, pressKey } from './keypad-reducer';

/** The add flow's form while it is being filled in. It lives in memory only, in `AddLayout`. */
export type DraftInput = {
  readonly idemKey: string;
  readonly amountMinor: number;
  readonly direction: Direction;
  /** As typed. The sanitiser runs on every read, so the stored text is always the cleaned one. */
  readonly description: string;
  readonly category: AddCategoryId | null;
  readonly day: DayKey;
};

export type DraftAction =
  | { readonly type: 'key'; readonly key: PadKey }
  | { readonly type: 'direction'; readonly direction: Direction }
  | { readonly type: 'description'; readonly text: string }
  | { readonly type: 'category'; readonly category: AddCategoryId }
  | { readonly type: 'day'; readonly day: DayKey };

export function newDraft(idemKey: string, today: DayKey): DraftInput {
  return {
    idemKey,
    amountMinor: 0,
    direction: 'debit',
    description: '',
    category: null,
    day: today,
  };
}

export function draftReducer(draft: DraftInput, action: DraftAction): DraftInput {
  switch (action.type) {
    case 'key':
      return { ...draft, amountMinor: pressKey(draft.amountMinor, action.key) };
    case 'direction':
      return { ...draft, direction: action.direction };
    case 'description':
      return { ...draft, description: action.text };
    case 'category':
      return { ...draft, category: action.category };
    case 'day':
      return { ...draft, day: action.day };
  }
}

/** Whether closing would lose something the user typed or picked. */
export function hasInput(draft: DraftInput): boolean {
  return draft.amountMinor > 0 || draft.description !== '' || draft.category !== null;
}

export type AmountProblem = 'empty' | 'over_limit';

export function amountProblem(sen: number): AmountProblem | null {
  if (sen < DRAFT_LIMITS.minMinor) return 'empty';
  if (sen > DRAFT_LIMITS.maxMinor) return 'over_limit';
  return null;
}

export function cleanDescription(draft: DraftInput): string {
  return sanitizeDescription(draft.description);
}

export function descriptionTooShort(draft: DraftInput): boolean {
  return cleanDescription(draft).length < DRAFT_LIMITS.descriptionMin;
}

/** The draft as the repo stores it, or null while any field is still missing or out of range. */
export function toDraft(draft: DraftInput, today: DayKey): Draft | null {
  const parsed = draftSchema(today).safeParse({ ...draft, description: cleanDescription(draft) });
  return parsed.success ? parsed.data : null;
}
