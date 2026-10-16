import type { MotionLevel } from '@/motion/policy';

export function cssMs(level: MotionLevel, ms: number): number {
  return level === 'full' ? ms : 0;
}
