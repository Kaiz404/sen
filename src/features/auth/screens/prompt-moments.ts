import { useEffect } from 'react';

import { type MomentId, playMoment, stopMoment } from '@/features/sen';

import type { AuthFailure, AuthOutcome } from '../prompt';

/**
 * Where the screen's prompt is. Every change is a new object, so two misses in a row each play their
 * moment.
 */
export type Prompt =
  | { readonly kind: 'notAsked' }
  | { readonly kind: 'asking' }
  | {
      readonly kind: 'answered';
      readonly outcome: AuthOutcome;
      /** The loop Sen goes back to when the answer has no moment, such as a nap after a cancel. */
      readonly rest?: MomentId;
    };

export const NOT_ASKED: Prompt = { kind: 'notAsked' };

/** The moment Sen plays for each answer. Any other answer, a cancel included, ends the scan. */
export type PromptAnswers = Readonly<Partial<Record<'ok' | AuthFailure, MomentId>>>;

/**
 * Plays the prompt's moments on a screen's Sen: the Face ID scan while the prompt is open, then the
 * moment for its answer, or its `rest` loop. A screen that has not asked plays nothing.
 */
export function usePromptMoments(sen: string, prompt: Prompt, answers: PromptAnswers): void {
  useEffect(() => {
    if (prompt.kind === 'asking') playMoment(sen, 'faceScan');
    if (prompt.kind !== 'answered') return;
    const { outcome, rest } = prompt;
    const moment = answers[outcome.ok ? 'ok' : outcome.reason] ?? rest;
    if (moment) playMoment(sen, moment);
    else stopMoment(sen);
  }, [sen, prompt, answers]);
}
