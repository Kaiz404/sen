/** Pull-to-refresh distances in pt. `threshold` and `max` come from the SF-HistoryStates pull board. */
export const PULL = {
  threshold: 72,
  max: 132,
  /** How tall the gap stays while the bank is asked. */
  hold: 96,
  /** Finger travel to gap height, the rubber band that makes the pull feel heavier than a scroll. */
  resistance: 0.6,
} as const;

/** Gap height for a finger that has dragged `drag` pt down from the top of the list. */
export function gapFor(drag: number): number {
  'worklet';
  const raw = Math.max(0, drag) * PULL.resistance;
  if (raw <= PULL.threshold) return raw;
  const over = raw - PULL.threshold;
  const room = PULL.max - PULL.threshold;
  return PULL.threshold + room * (1 - Math.exp(-over / room));
}

/** 0 at rest, 1 at the threshold. Sen stretches and rises out of the gap by this much. */
export function readiness(gap: number): number {
  'worklet';
  return Math.min(1, gap / PULL.threshold);
}

/** The board's stretch at the threshold: Sen is 1.18 tall and 0.9 wide. */
export function stretchFor(ready: number): { readonly sx: number; readonly sy: number } {
  'worklet';
  return { sx: 1 - 0.1 * ready, sy: 1 + 0.18 * ready };
}
