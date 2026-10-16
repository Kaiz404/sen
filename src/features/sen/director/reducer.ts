import type { MomentId, Priority } from '../timeline/types';

export type SenId = string;

/** What the director needs to know of a moment. The moments table supplies it. */
export type MomentInfo = (id: MomentId) => {
  readonly priority: Priority;
  readonly loop?: true;
  readonly then?: MomentId;
};

/** Every gate open means Sen may move: no scroll in flight, the screen focused, the app active. */
export type Gate = {
  readonly scroll: boolean;
  readonly focused: boolean;
  readonly appActive: boolean;
};

type Playing = { readonly sen: SenId; readonly moment: MomentId; readonly token: number };
type Queued = { readonly sen: SenId; readonly moment: MomentId };

export type DirectorState = {
  readonly sens: readonly SenId[];
  readonly gate: Gate;
  /** One slot, so only one Sen ever plays a moment. */
  readonly playing: Playing | null;
  readonly queued: Queued | null;
  readonly nextToken: number;
};

export type DirectorEvent =
  | { readonly type: 'register'; readonly sen: SenId }
  | { readonly type: 'unregister'; readonly sen: SenId }
  | { readonly type: 'request'; readonly sen: SenId; readonly moment: MomentId }
  | { readonly type: 'stop'; readonly sen: SenId }
  | { readonly type: 'finished'; readonly token: number }
  | { readonly type: 'gate'; readonly patch: Partial<Gate> };

/** `settle` stops whatever the Sen plays and eases it to the pose it rests in. */
export type Command =
  | {
      readonly type: 'play';
      readonly sen: SenId;
      readonly moment: MomentId;
      readonly token: number;
    }
  | { readonly type: 'settle'; readonly sen: SenId };

export const INITIAL: DirectorState = {
  sens: [],
  gate: { scroll: false, focused: true, appActive: true },
  playing: null,
  queued: null,
  nextToken: 1,
};

type Result = [DirectorState, Command[]];

const isOpen = (g: Gate) => !g.scroll && g.focused && g.appActive;

function play(s: DirectorState, sen: SenId, moment: MomentId, before: Command[] = []): Result {
  const token = s.nextToken;
  return [
    { ...s, playing: { sen, moment, token }, nextToken: token + 1 },
    [...before, { type: 'play', sen, moment, token }],
  ];
}

function next(s: DirectorState): Result {
  if (s.queued) return play({ ...s, queued: null }, s.queued.sen, s.queued.moment);
  return [{ ...s, playing: null }, []];
}

/**
 * The MotionDirector. A higher priority replaces what plays, and so does any request from the Sen
 * that plays it, or one that meets a loop. A lower one from the playing Sen is dropped, and the moment
 * ends by resting that Sen in its pose. Another Sen at the same priority waits in the one queue
 * slot, and the newest wins it. P0 never waits. A Sen whose request can't play settles into its pose.
 */
export function direct(s: DirectorState, e: DirectorEvent, info: MomentInfo): Result {
  switch (e.type) {
    case 'register':
      return [s.sens.includes(e.sen) ? s : { ...s, sens: [...s.sens, e.sen] }, []];

    case 'unregister': {
      const t: DirectorState = {
        ...s,
        sens: s.sens.filter((x) => x !== e.sen),
        queued: s.queued?.sen === e.sen ? null : s.queued,
      };
      return t.playing?.sen === e.sen ? next(t) : [t, []];
    }

    case 'request': {
      if (!s.sens.includes(e.sen)) return [s, []];
      const p = info(e.moment).priority;
      if (!isOpen(s.gate)) return [s, p === 0 ? [] : [{ type: 'settle', sen: e.sen }]];
      if (!s.playing) return play(s, e.sen, e.moment);
      const now = info(s.playing.moment);
      const same = s.playing.sen === e.sen;
      if (p > now.priority || (p === now.priority && (same || now.loop))) {
        return play(s, e.sen, e.moment, same ? [] : [{ type: 'settle', sen: s.playing.sen }]);
      }
      if (p === 0 || same) return [s, []];
      if (p === now.priority) {
        const bumped = s.queued && s.queued.sen !== e.sen ? s.queued.sen : null;
        return [
          { ...s, queued: { sen: e.sen, moment: e.moment } },
          bumped ? [{ type: 'settle', sen: bumped }] : [],
        ];
      }
      return [s, [{ type: 'settle', sen: e.sen }]];
    }

    case 'stop': {
      if (s.playing?.sen === e.sen) {
        const [t, commands] = next(s);
        return [t, [{ type: 'settle', sen: e.sen }, ...commands]];
      }
      return s.queued?.sen === e.sen ? [{ ...s, queued: null }, []] : [s, []];
    }

    case 'finished': {
      if (!s.playing || s.playing.token !== e.token) return [s, []];
      const then = info(s.playing.moment).then;
      return then ? play(s, s.playing.sen, then) : next(s);
    }

    case 'gate': {
      const gate = { ...s.gate, ...e.patch };
      if (isOpen(gate)) return [{ ...s, gate }, []];
      const sens = [s.playing?.sen, s.queued?.sen].filter(
        (x, i, all): x is SenId => x !== undefined && all.indexOf(x) === i,
      );
      return [
        { ...s, gate, playing: null, queued: null },
        sens.map((sen) => ({ type: 'settle', sen })),
      ];
    }
  }
}
