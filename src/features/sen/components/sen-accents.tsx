import type { ReactNode } from 'react';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { kf } from '@/motion/timeline';
import type { SenAccentTone } from '@/theme/colors';

import { ACCENT, type Keyframes } from '../art/accents';
import { accentShapes, type Shape, SWOOSH_LENGTH, VIEWBOX } from '../art/geometry';
import { mat } from '../art/matrix';
import { AnimatedG } from './animated-g';
import { ShapeEl } from './shape';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const at = (k: Keyframes, t: number) => {
  'worklet';
  return kf(t, k.stops, k.values, k.eases);
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

type Layer = { readonly fx: SharedValue<number>; readonly tone: SenAccentTone; readonly side: number };

/** The swoosh, behind the coin. It follows Sen's travel but never its roll or spin. */
export function SwooshLayer({ fx, tone, side }: Layer): ReactNode {
  const shape = accentShapes(tone).swoosh;
  const k = ACCENT.swoosh;
  const props = useAnimatedProps(() => {
    const t = fx.get();
    return { opacity: at(k.op, t), strokeDashoffset: (at(k.off, t) * SWOOSH_LENGTH) / 100 };
  });
  return (
    <Svg style={FILL} width={side} height={side} viewBox={VIEWBOX}>
      <AnimatedPath
        testID="sen-fx-sw"
        d={shape.kind === 'path' ? shape.d : ''}
        fill="none"
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={shape.strokeDasharray}
        animatedProps={props}
      />
    </Svg>
  );
}

function Star({ fx, i, shape, x, y, base }: { fx: SharedValue<number>; i: number; shape: Shape; x: number; y: number; base: number }) {
  const k = ACCENT.stars[i]!;
  const props = useAnimatedProps(() => {
    const t = fx.get();
    const s = base * at(k.s, t);
    return { opacity: at(k.op, t), matrix: mat(x, y, at(k.r, t), s, s, 0, 0) };
  });
  return (
    <AnimatedG testID={`sen-fx-s${i + 1}`} animatedProps={props}>
      <ShapeEl shape={shape} />
    </AnimatedG>
  );
}

function Tick({ fx, i, shape }: { fx: SharedValue<number>; i: number; shape: Shape }) {
  const k = ACCENT.ticks[i]!;
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] =
    shape.kind === 'path' ? (shape.d.match(/-?\d+/g) ?? []).map(Number) : [];
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const props = useAnimatedProps(() => {
    const t = fx.get();
    const s = at(k.s, t);
    return { opacity: at(k.op, t), matrix: mat(at(k.x, t), at(k.y, t), 0, s, s, cx, cy) };
  });
  return (
    <AnimatedG testID={`sen-fx-t${i + 1}`} animatedProps={props}>
      <ShapeEl shape={shape} />
    </AnimatedG>
  );
}

/** Sparkle stars and ticks, in front of the coin. They follow Sen's travel but never its roll or spin. */
export function SparkLayer({ fx, tone, side }: Layer): ReactNode {
  const { stars, ticks } = accentShapes(tone);
  return (
    <Svg style={FILL} width={side} height={side} viewBox={VIEWBOX}>
      {stars.map((s, i) => (
        <Star key={i} fx={fx} i={i} shape={s.shape} x={s.at[0]} y={s.at[1]} base={s.scale} />
      ))}
      {ticks.map((t, i) => (
        <Tick key={i} fx={fx} i={i} shape={t} />
      ))}
    </Svg>
  );
}
