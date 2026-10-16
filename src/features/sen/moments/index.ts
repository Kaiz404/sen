import type { PoseId } from '../poses';
import type { Moment, MomentId } from '../timeline/types';
import { blink, doubleBlink, glance, lockPeek, slowBlink } from './ambient';

export const MOMENTS: Readonly<Record<MomentId, Moment>> = {
  blink,
  doubleBlink,
  glance,
  lockPeek,
  slowBlink,
};

/** The moment a Sen plays when its `pose` changes from one pose to another. */
export const TRANSITIONS: Readonly<Partial<Record<`${PoseId}>${PoseId}`, MomentId>>> = {};

export function transitionFor(from: PoseId, to: PoseId): MomentId | undefined {
  return TRANSITIONS[`${from}>${to}`];
}

export { AMBIENT, ambientFor, nextBeat } from './ambient';
