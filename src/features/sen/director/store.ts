import { MOMENTS } from '../moments';
import type { Moment, MomentId } from '../timeline/types';
import {
  type Command,
  direct,
  type DirectorEvent,
  type DirectorState,
  type Gate,
  INITIAL,
  type SenId,
} from './reducer';

/** How the director reaches a rig. It never touches shared values itself. */
export type RigHandle = {
  readonly play: (moment: Moment, token: number) => void;
  readonly settle: () => void;
};

const handles = new Map<SenId, RigHandle>();
let state: DirectorState = INITIAL;

function run(c: Command): void {
  const rig = handles.get(c.sen);
  if (!rig) return;
  if (c.type === 'play') rig.play(MOMENTS[c.moment], c.token);
  else rig.settle();
}

function dispatch(e: DirectorEvent): void {
  const [next, commands] = direct(state, e, (id) => MOMENTS[id]);
  state = next;
  commands.forEach(run);
}

export function registerSen(sen: SenId, rig: RigHandle): () => void {
  handles.set(sen, rig);
  dispatch({ type: 'register', sen });
  return () => {
    if (handles.get(sen) !== rig) return;
    handles.delete(sen);
    dispatch({ type: 'unregister', sen });
  };
}

/** Asks the director to play a moment on the Sen rendered with this `id`. */
export function playMoment(sen: SenId, moment: MomentId): void {
  dispatch({ type: 'request', sen, moment });
}

export function momentFinished(token: number): void {
  dispatch({ type: 'finished', token });
}

/** Closes or opens a gate. A closed gate stops the moment and settles its Sen into its pose. */
export function senGate(patch: Partial<Omit<Gate, 'scroll'>>): void {
  dispatch({ type: 'gate', patch });
}

const SCROLL_RESUME_MS = 1500;
let resume: ReturnType<typeof setTimeout> | undefined;

/** Lists call this as a scroll starts and as its momentum ends. Sen waits 1.5 s after the end. */
export function senScroll(scrolling: boolean): void {
  clearTimeout(resume);
  if (scrolling) dispatch({ type: 'gate', patch: { scroll: true } });
  else
    resume = setTimeout(
      () => dispatch({ type: 'gate', patch: { scroll: false } }),
      SCROLL_RESUME_MS,
    );
}
