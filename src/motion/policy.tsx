import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

/** One level for every animation in the app. Settings calls it "Sen's animations". */
export type MotionLevel = 'full' | 'calm' | 'off';

/** System Reduce Motion turns Full into Calm. It never relaxes a stricter choice. */
export function resolveMotion(preference: MotionLevel, systemReduce: boolean): MotionLevel {
  return systemReduce && preference === 'full' ? 'calm' : preference;
}

const MotionLevelContext = createContext<MotionLevel>('full');

type MotionPolicyRootProps = {
  /** The user's "Sen's animations" setting. The caller reads it, because motion never touches prefs. */
  preference: MotionLevel;
  children: ReactNode;
};

/**
 * Mounted once, in the root layout. It owns the only live Reduce Motion subscription, resolves the level,
 * provides it, and renders `<ReducedMotionConfig>`: `Never` in Full and `Always` otherwise, the safety net
 * for worklet animations that don't read the level themselves.
 */
export function MotionPolicyRoot({ preference, children }: MotionPolicyRootProps): ReactNode {
  const [systemReduce, setSystemReduce] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setSystemReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const level = resolveMotion(preference, systemReduce);
  return (
    <MotionLevelContext value={level}>
      <ReducedMotionConfig mode={level === 'full' ? ReduceMotion.Never : ReduceMotion.Always} />
      {children}
    </MotionLevelContext>
  );
}

/** The resolved level. Without a root above it, as in a component test, it is `'full'`. */
export function useMotionPolicy(): MotionLevel {
  return use(MotionLevelContext);
}
