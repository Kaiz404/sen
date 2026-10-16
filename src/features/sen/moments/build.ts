import { type BoardStep, boardTracks } from '../board';
import { BOARDS } from '../board.gen';
import type { Channel, Frame } from '../channels';
import type { Ease, Step, Steps, Tracks } from '../timeline/types';

type BoardMoment = Readonly<Record<string, readonly BoardStep[]>>;

export const MOMENTS_BOARD: Readonly<Record<string, BoardMoment>> = BOARDS['MAX-Moments'];
export const LIBRARY_BOARD: Readonly<Record<string, BoardMoment>> = BOARDS['MAX-Library'];

/** The rig channels a MAX-Moments tile animates between `from` and `to` ms, rebased to 0. */
export function moments(selector: string, from: number, to: number): Tracks {
  return boardTracks(MOMENTS_BOARD[selector]!, { from, to });
}

export function library(selector: string, from: number, to: number): Tracks {
  return boardTracks(LIBRARY_BOARD[selector]!, { from, to });
}

/**
 * The board loops, so a tile opens on the state its loop ends in, which can differ from the pose the
 * app moment starts from. This holds the opening run at `v` instead.
 */
export function startFrom(steps: Steps, v: number): Steps {
  const first = steps[0].v;
  let i = 0;
  while (i < steps.length && steps[i]!.v === first) i++;
  const hold = (s: Step, j: number): Step => (j < i ? { ...s, v } : s);
  const [head, ...rest] = steps;
  return [hold(head, 0), ...rest.map((s, j) => hold(s, j + 1))];
}

/** Adds an ease into the end pose for every track that doesn't already end there. */
export function settleInto(tracks: Tracks, to: Frame, at: number, ms: number, ease: Ease = 'sine'): Tracks {
  const out: Partial<Record<Channel, Steps>> = {};
  for (const [ch, steps] of Object.entries(tracks) as [Channel, Steps][]) {
    const last = steps[steps.length - 1]!;
    const tail: Step[] = [
      { at, v: last.v },
      { at: at + ms, v: to[ch], ease },
    ];
    out[ch] = last.v === to[ch] ? steps : [...steps, ...tail];
  }
  return out;
}

export function without(tracks: Tracks, channels: readonly Channel[]): Tracks {
  const out = { ...tracks };
  for (const ch of channels) delete out[ch];
  return out;
}
