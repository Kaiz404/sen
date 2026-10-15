import type { ReactNode } from 'react';

import { SenStatic } from './components/sen-static';
import type { SenProps } from './sen-props';

export function Sen({ pose, size, prop, label }: SenProps): ReactNode {
  return <SenStatic pose={pose} size={size} prop={prop} label={label} />;
}

export type { SenProps } from './sen-props';
export { POSE_IDS, PROP_IDS, type PoseId, type PropId } from './poses';
