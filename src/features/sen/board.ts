import { type Channel, CHANNELS } from './channels';
import type { Ease, Step, Steps, Tracks } from './timeline/types';

export type BoardStep = readonly [at: number, v: number, ease?: Ease];
export type BoardData = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, readonly BoardStep[]>>>>>
>;

const IS_CHANNEL: ReadonlySet<string> = new Set(CHANNELS);

type Window = { readonly from?: number; readonly to: number };

/**
 * The steps of one board track between `from` and `to`, rebased so `from` is 0. The board loops, so
 * a moment is the stretch that starts at its first pose and ends where the next pose holds.
 */
export function slice(steps: readonly BoardStep[], { from = 0, to }: Window): Step[] {
  const inside = steps.filter(([at]) => at >= from && at <= to);
  const before = steps.filter(([at]) => at < from).at(-1);
  const head = inside[0];
  const lead: BoardStep[] = before && (!head || head[0] > from) ? [[from, before[1]]] : [];
  return [...lead, ...inside].map(([at, v, ease]) =>
    ease === undefined ? { at: at - from, v } : { at: at - from, v, ease },
  );
}

/** Every rig channel a board moment animates in the window. A track that never changes is left out. */
export function boardTracks(moment: Readonly<Record<string, readonly BoardStep[]>>, w: Window): Tracks {
  const out: Partial<Record<Channel, Steps>> = {};
  for (const [key, steps] of Object.entries(moment)) {
    if (!IS_CHANNEL.has(key)) continue;
    const [head, ...rest] = slice(steps, w);
    if (head && rest.some((step) => step.v !== head.v)) out[key as Channel] = [head, ...rest];
  }
  return out;
}
