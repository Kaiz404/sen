import type { MotionLevel } from '@/motion/policy';

/** CSS transitions and keyframes ignore reduced motion, so components zero them outside Full. */
export function cssMs(level: MotionLevel, ms: number): number {
  return level === 'full' ? ms : 0;
}
