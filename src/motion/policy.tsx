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

export function useMotionPolicy(): MotionLevel {
  return use(MotionLevelContext);
}
