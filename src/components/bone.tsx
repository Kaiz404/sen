import { type ReactNode, useId } from 'react';
import { type DimensionValue, View, type ViewStyle } from 'react-native';
import Animated, { type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type MotionLevel, useEffectiveMotionLevel } from '@/motion/policy';
import { DUR } from '@/motion/tokens';

const SWEEP: CSSAnimationKeyframes<ViewStyle> = {
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '100%' }] },
};

export function bandStyle(level: MotionLevel): CSSStyle<ViewStyle> | null {
  if (level !== 'full') return null;
  return {
    animationName: SWEEP,
    animationDuration: DUR.bone,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  };
}

type BoneProps = {
  readonly width: DimensionValue;
  readonly height: number;
  readonly radius?: number;
};

export function Bone({ width, height, radius = 8 }: BoneProps): ReactNode {
  const band = bandStyle(useEffectiveMotionLevel());
  const gradient = useId();
  const { theme } = useUnistyles();
  return (
    <View aria-hidden style={[styles.bone, { width, height, borderRadius: radius }]}>
      {band !== null && (
        <Animated.View style={[StyleSheet.absoluteFill, band]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0.2" stopColor={theme.colors.shimmer} stopOpacity={0} />
                <Stop offset="0.5" stopColor={theme.colors.shimmer} stopOpacity={1} />
                <Stop offset="0.8" stopColor={theme.colors.shimmer} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bone: { overflow: 'hidden', backgroundColor: theme.colors.chip },
}));
