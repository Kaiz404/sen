import type { PoseId, PropId } from './poses';

/**
 * The one public Sen. Every screen in every lane places Sen through `<Sen>`, so these props are a contract.
 * Without `id` it renders `SenStatic`: memoised, no Reanimated hooks. With `id` it renders the animated
 * rig (lane 4d), which registers with the MotionDirector under that id. Until the rig exists, `id` is
 * accepted and every Sen renders static.
 */
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
