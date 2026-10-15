import type { PoseId, PropId } from './poses';

export type SenProps = {
  readonly pose: PoseId;
  /** The coin box in pt. Layout uses this alone, and the drawing overhangs it by 40/600 on each side. */
  readonly size: number;
  /** Overrides the pose's default prop. `null` removes it. */
  readonly prop?: PropId | null;
  readonly id?: string;
  /** Spoken label. Omitted means decorative and hidden from screen readers. */
  readonly label?: string;
};
