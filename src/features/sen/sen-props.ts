import type { SenAccentTone } from '@/theme/colors';

import type { PoseId, PropId } from './poses';

export type SenProps = {
  readonly pose: PoseId;
  /** The coin box in pt. Layout uses this alone, and the drawing overhangs it by 40/600 on each side. */
  readonly size: number;
  /** Overrides the pose's default prop. `null` removes it. */
  readonly prop?: PropId | null;
  /** Names this Sen to the director, so it animates. Without it Sen is a still drawing. */
  readonly id?: string;
  /** The surface Sen sits on, which colours its accents. Defaults to the cream canvas. */
  readonly surface?: SenAccentTone;
  /** Spoken label. Omitted means decorative and hidden from screen readers. */
  readonly label?: string;
};
