import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotionPolicy } from '@/motion/policy';
import { kf } from '@/motion/timeline';
import { playHaptic } from '@/services/haptics';
import { FONT } from '@/theme/type';

import type { Keyframes } from '../board';
import type { Channel } from '../channels';
import {
  BOARD_FACE_R,
  BOARD_PANEL_INSET,
  DONE_MS,
  HANDOFF_MS,
  HOP,
  HOP_MS,
  LAND_MS,
  LAUNCH,
  LAUNCH_RIG,
  LAYOUT,
  STORY_MS,
  SWOOSH_D,
  SWOOSH_LENGTH,
} from '../moments/launch';
import { poseFrame } from '../poses';
import { makeRig } from './rig-values';
import { RigDrawing } from './sen-rig';

/** Where Lock draws its Sen and how tall its hero is, in window points. The launch ends exactly there. */
export type LaunchTarget = {
  readonly sen: { readonly x: number; readonly y: number; readonly size: number };
  readonly heroHeight: number;
};

type Props = {
  readonly target: LaunchTarget;
  /** Lock is ready to take over. Until then Sen hops on the period. */
  readonly ready: boolean;
  /** The loader has handed off to Lock and can unmount. */
  readonly onDone: () => void;
};

const NEVER = ReduceMotion.Never;
const steady = { easing: Easing.linear, reduceMotion: NEVER };
const at = (k: Keyframes, t: number) => {
  'worklet';
  return kf(t, k.stops, k.values, k.eases);
};

const RIG_KEYS = Object.keys(LAUNCH_RIG) as Channel[];
/** The calm launch shows this frame: Sen settled into the period, the wordmark whole. */
const REST_MS = STORY_MS;
const CALM_HOLD_MS = 400;
const CALM_FADE_MS = 200;
/** A light impact on the landing. The haptics service has no launch event, so this borrows Copy's. */
const LANDING = 'copy';

/**
 * MAL2, "Sen is the dot". Mounted over Lock, which renders underneath from the first frame. Sen
 * falls onto the S, hops across the letters, lands as the period with a light haptic, winks, then
 * grows into Lock's Sen while the ink panel shrinks into Lock's hero. Every part reads one clock `t`,
 * so nothing re-renders while it plays. Calm and Off show the rest frame, hold it 400 ms and cross
 * fade to Lock in 200 ms, with no travel, accents or haptic.
 */
export function SenLaunch({ target, ready, onDone }: Props): ReactNode {
  const level = useMotionPolicy();
  const calm = level !== 'full';
  const { width, height } = useWindowDimensions();
  const { theme } = useUnistyles();
  const t = useSharedValue(calm ? REST_MS : 0);
  const hop = useSharedValue(HOP_MS);
  const fade = useSharedValue(1);
  const [rig] = useState(() => makeRig(poseFrame('idle')));
  const phase = useRef<'story' | 'waiting' | 'handoff'>('story');

  const { size } = target.sen;
  const k = (size * (222 / 600)) / BOARD_FACE_R;
  const cx = target.sen.x + size / 2;
  const cy = target.sen.y + size / 2;
  const shrink = height - target.heroHeight;

  const finish = useEffectEvent(() => onDone());
  const handoff = useEffectEvent(() => {
    phase.current = 'handoff';
    const left = HOP_MS - hop.get();
    cancelAnimation(hop);
    hop.set(
      withTiming(HOP_MS, { duration: left, ...steady }, () => {
        'worklet';
        t.set(
          withTiming(DONE_MS, { duration: DONE_MS - STORY_MS, ...steady }, (done) => {
            'worklet';
            if (done) scheduleOnRN(finish);
          }),
        );
      }),
    );
  });
  const storyDone = useEffectEvent(() => {
    if (ready) return handoff();
    phase.current = 'waiting';
    hop.set(0);
    hop.set(withRepeat(withTiming(HOP_MS, { duration: HOP_MS, ...steady }), -1, false, undefined, NEVER));
  });

  useEffect(() => {
    if (calm) return;
    t.set(
      withSequence(
        NEVER,
        withTiming(LAND_MS, { duration: LAND_MS, ...steady }, (done) => {
          'worklet';
          if (done) scheduleOnRN(playHaptic, LANDING);
        }),
        withTiming(STORY_MS, { duration: STORY_MS - LAND_MS, ...steady }, (done) => {
          'worklet';
          if (done) scheduleOnRN(storyDone);
        }),
      ),
    );
    return () => cancelAnimation(t);
  }, [calm, t]);

  useEffect(() => {
    if (!ready) return;
    if (calm) {
      fade.set(
        withDelay(
          CALM_HOLD_MS,
          withTiming(0, { duration: CALM_FADE_MS, reduceMotion: NEVER }, (done) => {
            'worklet';
            if (done) scheduleOnRN(finish);
          }),
          NEVER,
        ),
      );
    } else if (phase.current === 'waiting') handoff();
  }, [ready, calm, fade]);

  useAnimatedReaction(
    () => t.get(),
    (now) => {
      for (const ch of RIG_KEYS) rig[ch].set(at(LAUNCH_RIG[ch]!, now));
    },
  );

  const ui = useAnimatedStyle(() => ({ opacity: 1 - at(LAUNCH.lockUi, t.get()) }));
  const cover = useAnimatedStyle(() => {
    const now = t.get();
    return { opacity: fade.get() * kf(now, [HANDOFF_MS, DONE_MS], [1, 0]) };
  });
  const panel = useAnimatedStyle(() => {
    const now = t.get();
    const r = at(LAUNCH.panel.round, now);
    return {
      height: height - (shrink * at(LAUNCH.panel.inset, now)) / BOARD_PANEL_INSET,
      borderBottomLeftRadius: r,
      borderBottomRightRadius: r,
    };
  });
  const sen = useAnimatedStyle(() => {
    const now = t.get();
    return {
      transform: [
        { translateX: at(LAUNCH.x, now) * k },
        { translateY: (at(LAUNCH.y, now) + at(HOP, hop.get())) * k },
        { scale: at(LAUNCH.scale, now) },
      ],
    };
  });
  const wordmark = useAnimatedStyle(() => {
    const now = t.get();
    return {
      opacity: at(LAUNCH.wordmark.op, now),
      transform: [{ translateY: at(LAUNCH.wordmark.y, now) * k }],
    };
  });

  const [px, py] = LAYOUT.period;
  const fxX = cx + px * k;
  const fxY = cy + py * k;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Sen"
      style={{ position: 'absolute', top: 0, left: 0, width, height }}
    >
      <Animated.View
        testID="launch-veil"
        style={[{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: theme.colors.canvas }, ui]}
      />
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height }, cover]}>
        <Animated.View
          testID="launch-panel"
          style={[{ position: 'absolute', top: 0, left: 0, width, overflow: 'hidden', backgroundColor: theme.colors.hero }, panel]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                right: width - (cx + LAYOUT.wordmarkRight * k),
                top: cy + LAYOUT.wordmarkTop * k,
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 4 * k,
              },
              wordmark,
            ]}
          >
            {(['S', 'e', 'n'] as const).map((ch, i) => (
              <Letter key={ch} ch={ch} i={i} t={t} k={k} color={theme.colors.onHero} />
            ))}
            <View style={{ width: 28 * k, height: 28 * k }} />
          </Animated.View>
          <Swoosh t={t} k={k} x={fxX} y={fxY} color={theme.colors.onHero} />
          <Animated.View
            testID="launch-sen"
            style={[{ position: 'absolute', left: target.sen.x, top: target.sen.y, width: size, height: size }, sen]}
          >
            <RigDrawing rig={rig} fx={null} size={size} surface="onHero" />
          </Animated.View>
          {[theme.colors.lemon, theme.colors.lilac, theme.colors.onHero].map((color, i) => (
            <Spark key={i} i={i} t={t} k={k} x={fxX} y={fxY} color={color} />
          ))}
          {[-32, 0, 32].map((turn, i) => (
            <Tick key={turn} i={i} turn={turn} t={t} k={k} x={fxX} y={fxY} color={theme.colors.onHero} />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

type Part = { readonly t: SharedValue<number>; readonly k: number; readonly color: string };

function Letter({ ch, i, t, k, color }: Part & { ch: string; i: number }) {
  const l = LAUNCH.letters[i]!;
  const style = useAnimatedStyle(() => {
    const now = t.get();
    return {
      transform: [
        { translateY: at(l.y, now) * k },
        { scaleX: at(l.sx, now) },
        { scaleY: at(l.sy, now) },
      ],
    };
  });
  return (
    <Animated.View testID={`launch-l${i + 1}`} style={[{ transformOrigin: ['50%', '100%', 0] }, style]}>
      <Text
        style={{
          fontFamily: FONT.numerals,
          fontSize: 112 * k,
          lineHeight: 112 * k,
          letterSpacing: -0.04 * 112 * k,
          color,
        }}
      >
        {ch}
      </Text>
    </Animated.View>
  );
}

const SPARKS = [
  { at: [-34, -30], px: 22 },
  { at: [30, -40], px: 15 },
  { at: [-46, 4], px: 11 },
] as const;
const STAR = 'M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10Z';

function Spark({ i, t, k, x, y, color }: Part & { i: number; x: number; y: number }) {
  const s = LAUNCH.sparks[i]!;
  const { at: pos, px } = SPARKS[i]!;
  const side = px * k;
  const style = useAnimatedStyle(() => {
    const now = t.get();
    return {
      opacity: at(s.op, now),
      transform: [{ scale: at(s.s, now) }, { rotate: `${at(s.r, now)}deg` }],
    };
  });
  return (
    <Animated.View
      testID={`launch-sp${i + 1}`}
      style={[
        { position: 'absolute', left: x + pos[0] * k - side / 2, top: y + pos[1] * k - side / 2, width: side, height: side },
        style,
      ]}
    >
      <Svg width={side} height={side} viewBox="-10 -10 20 20">
        <Path d={STAR} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function Tick({ i, turn, t, k, x, y, color }: Part & { i: number; turn: number; x: number; y: number }) {
  const s = LAUNCH.ticks[i]!;
  const style = useAnimatedStyle(() => {
    const now = t.get();
    return {
      opacity: at(s.op, now),
      transform: [{ translateY: at(s.y, now) * k }, { scaleY: at(s.sy, now) }],
    };
  });
  return (
    <View
      style={{
        position: 'absolute',
        left: x - 2 * k,
        top: y - 13 * k,
        width: 4 * k,
        height: 13 * k,
        transformOrigin: ['50%', '100%', 0],
        transform: [{ rotate: `${turn}deg` }, { translateY: -34 * k }],
      }}
    >
      <Animated.View
        testID={`launch-tk${i + 1}`}
        style={[{ width: 4 * k, height: 13 * k, borderRadius: 2 * k, backgroundColor: color }, style]}
      />
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Swoosh({ t, k, x, y, color }: Part & { x: number; y: number }) {
  const props = useAnimatedProps(() => {
    const now = t.get();
    return {
      opacity: at(LAUNCH.swoosh.op, now),
      strokeDashoffset: (at(LAUNCH.swoosh.off, now) * SWOOSH_LENGTH) / 100,
    };
  });
  return (
    <Svg
      style={{ position: 'absolute', left: x - 80 * k, top: y - 240 * k }}
      width={160 * k}
      height={260 * k}
      viewBox="-80 -240 160 260"
    >
      <AnimatedPath
        testID="launch-sw"
        d={SWOOSH_D}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={SWOOSH_LENGTH}
        animatedProps={props}
      />
    </Svg>
  );
}

