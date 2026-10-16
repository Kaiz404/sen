import type { PoseId } from '../poses';
import type { Moment, MomentId } from '../timeline/types';
import { blink, doubleBlink, glance, lockPeek, slowBlink } from './ambient';
import { remask, reveal, unlock } from './amounts';
import { copy, saved, themeDark, themeLight } from './feedback';
import {
  emptySearch,
  networkError,
  networkRetry,
  refreshLand,
  refreshSpin,
  refreshSpinLoop,
} from './history';
import { authFailed, faceScan, lockout, lockoutBreathe, lockoutWake } from './lock';

export const MOMENTS: Readonly<Record<MomentId, Moment>> = {
  unlock,
  reveal,
  remask,
  faceScan,
  authFailed,
  lockout,
  lockoutBreathe,
  lockoutWake,
  networkError,
  networkRetry,
  copy,
  saved,
  refreshSpin,
  refreshSpinLoop,
  refreshLand,
  emptySearch,
  themeLight,
  themeDark,
  blink,
  doubleBlink,
  glance,
  lockPeek,
  slowBlink,
};

/** The moment a Sen plays when its `pose` changes from one pose to another. */
export const TRANSITIONS: Readonly<Partial<Record<`${PoseId}>${PoseId}`, MomentId>>> = {
  'masked>happy': 'unlock',
  'masked>revealed': 'reveal',
  'revealed>masked': 'remask',
  'idle>cool': 'themeLight',
  'cool>idle': 'themeDark',
};

export function transitionFor(from: PoseId, to: PoseId): MomentId | undefined {
  return TRANSITIONS[`${from}>${to}`];
}

export { AMBIENT, ambientFor, nextBeat } from './ambient';
