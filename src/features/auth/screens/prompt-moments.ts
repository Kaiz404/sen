import { useEffect, useRef } from 'react';

import { type MomentId, playMoment, stopMoment } from '@/features/sen';

import type { PromptView } from '../prompt-view';

export type PromptKind = PromptView['kind'] | 'checking' | 'signingOut' | 'unlocked';

/** The moment Sen plays for each answer the prompt gives. Any other answer ends the scan. */
export type PromptAnswers = Readonly<Partial<Record<PromptKind, MomentId>>>;

/**
 * Plays the prompt's moments on a screen's Sen as its state moves: the Face ID scan while the prompt
 * is open, then the moment for its answer. A screen that mounts in a state plays nothing, so the
 * gallery draws each state still.
 */
export function usePromptMoments(sen: string, kind: PromptKind, answers: PromptAnswers): void {
  const last = useRef(kind);
  useEffect(() => {
    const was = last.current;
    last.current = kind;
    if (was === kind) return;
    if (kind === 'checking') return playMoment(sen, 'faceScan');
    if (was !== 'checking') return;
    const answer = answers[kind];
    if (answer) playMoment(sen, answer);
    else stopMoment(sen);
  }, [sen, kind, answers]);
}
