import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

export type MotionLevel = 'full' | 'calm' | 'off';

export function resolveMotion(preference: MotionLevel, systemReduce: boolean): MotionLevel {
  return systemReduce && preference === 'full' ? 'calm' : preference;
}

const MotionLevelContext = createContext<MotionLevel>('full');

type MotionPolicyRootProps = {
  preference: MotionLevel;
  children: ReactNode;
};

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

const MotionFrozenContext = createContext(false);

/**
 * Stills every looping animation under it: the skeleton band, Sen's ambient beats and rest loops, and the
 * lockout countdown. Only the dev gallery mounts it, so a shot settles at once and Maestro does not wait on a
 * loop. The motion level is left alone.
 */
export function FrozenMotion({ children }: { children: ReactNode }): ReactNode {
  return <MotionFrozenContext value>{children}</MotionFrozenContext>;
}

export function useMotionFrozen(): boolean {
  return use(MotionFrozenContext);
}

/** The level that looping animations obey: `off` under `FrozenMotion`. */
export function useLoopLevel(): MotionLevel {
  const level = useMotionPolicy();
  return useMotionFrozen() ? 'off' : level;
}

export function useMotionPolicy(): MotionLevel {
  return use(MotionLevelContext);
}
