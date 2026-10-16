import type { ReactNode } from 'react';

import { SenRig } from './components/sen-rig';
import { SenStatic } from './components/sen-static';
import type { SenProps } from './sen-props';

export function Sen({ id, surface, ...still }: SenProps): ReactNode {
  if (id !== undefined) return <SenRig id={id} surface={surface} {...still} />;
  return <SenStatic {...still} />;
}

export type { SenProps } from './sen-props';
export { POSE_IDS, PROP_IDS, type PoseId, type PropId } from './poses';
export { playMoment, senGate, senScroll, stopMoment } from './director/store';
export { MOMENT_IDS, type MomentId } from './timeline/types';
export { type LaunchTarget, SenLaunch } from './components/sen-launch';
export { SEN_STATES } from './states';
