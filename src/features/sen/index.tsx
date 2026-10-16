import type { ReactNode } from 'react';

import { SenRig } from './components/sen-rig';
import { SenStatic } from './components/sen-static';
import type { SenProps } from './sen-props';

export function Sen({ id, pose, size, prop, label }: SenProps): ReactNode {
  if (id !== undefined) return <SenRig id={id} pose={pose} size={size} prop={prop} label={label} />;
  return <SenStatic pose={pose} size={size} prop={prop} label={label} />;
}

export type { SenProps } from './sen-props';
export { POSE_IDS, PROP_IDS, type PoseId, type PropId } from './poses';
export { playMoment, senGate, senScroll } from './director/store';
export { MOMENT_IDS, type MomentId } from './timeline/types';
