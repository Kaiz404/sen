import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';

import { type MotionLevel, useMotionPolicy } from '@/motion/policy';
import { playHaptic } from '@/services/haptics';
import type { SenAccentTone } from '@/theme/colors';

import { type Channel, type Frame } from '../channels';
import { EDGE, FACE_CLIP, PIVOT, senBox, senTier, transformOrigin, VIEWBOX } from '../art/geometry';
import { ACCENT_MS } from '../art/accents';
import { type BodyStyle, NODES, type SvgProps, type TreeNode, treeFor } from '../art/nodes';
import { momentFinished, playMoment, registerSen } from '../director/store';
import { ambientFor, isBeat, nextBeat, transitionFor } from '../moments';
import { poseFrame, type PoseId, type PropId } from '../poses';
import type { SenProps } from '../sen-props';
import { formFor, NEVER } from '../timeline/compile';
import type { Moment } from '../timeline/types';
import { AnimatedG } from './animated-g';
import { makeRig, pick, type RigValues, settle, snap, start, stop } from './rig-values';
import { SparkLayer, SwooshLayer } from './sen-accents';
import { ShapeEl } from './shape';

type Read<P> = (f: Frame, unit: number) => P;

function useNodeProps(rig: RigValues, channels: readonly Channel[], read: Read<SvgProps>) {
  const [vals] = useState(() => pick(rig, channels));
  return useAnimatedProps(() => {
    const f: Record<string, number> = {};
    for (const ch in vals) f[ch] = vals[ch]!.get();
    return read(f as Frame, 1);
  });
}

function RigNode({ n, rig, clip }: { n: TreeNode; rig: RigValues; clip: string }): ReactNode {
  const def = NODES[n.node];
  const props = useNodeProps(rig, def.channels, def.read as Read<SvgProps>);
  const group = (
    <AnimatedG testID={`sen-${n.node}`} animatedProps={props}>
      {n.children?.map((child) => (
        <RigNode key={child.node} n={child} rig={rig} clip={clip} />
      ))}
      {n.shapes?.map((shape, i) => (
        <ShapeEl key={i} shape={shape} />
      ))}
    </AnimatedG>
  );
  return n.clip ? <G clipPath={`url(#${clip})`}>{group}</G> : group;
}

type BodyId = 'mv' | 'rl' | 'sq' | 'sp';

function useBody(rig: RigValues, id: BodyId, unit: number) {
  const def = NODES[id];
  const read = def.read as Read<BodyStyle>;
  const [vals] = useState(() => pick(rig, def.channels));
  return useAnimatedStyle(() => {
    const f: Record<string, number> = {};
    for (const ch in vals) f[ch] = vals[ch]!.get();
    return read(f as Frame, unit);
  });
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const COIN = transformOrigin(PIVOT.coin);
const CONTACT = transformOrigin(PIVOT.contact);
const EDGE_NODE: TreeNode = { node: 'edge', shapes: [EDGE] };

/**
 * Starts a moment's tracks and the clock that fires its marks and its end, in one UI-thread job, so
 * every haptic lands on the frame it belongs to.
 */
function begin(
  rig: RigValues,
  clock: SharedValue<number>,
  fx: SharedValue<number> | null,
  m: Moment,
  from: Frame,
  level: MotionLevel,
  onEnd: () => void,
): void {
  'worklet';
  start(rig, m, from, level);
  cancelAnimation(clock);
  if (m.loop) return;
  let t = 0;
  const marks = [...m.marks].sort((a, b) => a.at - b.at);
  const parts = marks.map(({ at, haptic, accents }) => {
    const duration = at - t;
    t = at;
    const pop = accents && fx;
    return withTiming(at, { duration, reduceMotion: NEVER }, (done) => {
      'worklet';
      if (!done) return;
      if (haptic) scheduleOnRN(playHaptic, haptic);
      if (pop) {
        fx.set(0);
        fx.set(
          withTiming(ACCENT_MS, {
            duration: ACCENT_MS,
            easing: Easing.linear,
            reduceMotion: NEVER,
          }),
        );
      }
    });
  });
  parts.push(
    withTiming(m.dur, { duration: Math.max(0, m.dur - t), reduceMotion: NEVER }, (done) => {
      'worklet';
      if (done) scheduleOnRN(onEnd);
    }),
  );
  clock.set(0);
  clock.set(withSequence(NEVER, ...parts));
}

type Rest = {
  readonly pose: PoseId;
  readonly prop: PropId | null | undefined;
  readonly level: MotionLevel;
  readonly full: boolean;
};

/**
 * The animated Sen. One shared value per channel, and every part reads only its own, so a still part
 * does no work. It rests in its `pose`. A pose change plays the moment between the two poses when
 * there is one (TRANSITIONS), and eases there otherwise. The director decides what plays.
 */
export function SenRig({
  id,
  pose,
  size,
  prop,
  label,
  surface = 'onCanvas',
}: SenProps & { id: string }): ReactNode {
  const level = useMotionPolicy();
  const [rig] = useState(() => makeRig(poseFrame(pose, prop)));
  const [clock] = useState(() => makeMutable(0));
  const [fx] = useState(() => makeMutable(ACCENT_MS));
  const full = senTier(size) === 'full';
  const rest = useRef<Rest>({ pose, prop, level, full });
  const playing = useRef<{ token: number; moment: Moment } | null>(null);
  const shown = useRef(pose);
  /** Ambient beats played since the last other moment, so idle rests after three. */
  const beats = useRef(0);

  useEffect(() => {
    rest.current = { pose, prop, level, full };
  });

  useEffect(() => {
    const restInPose = () => {
      const r = rest.current;
      scheduleOnUI(settle, rig, poseFrame(r.pose, r.prop), r.level);
    };
    const end = (token: number) => {
      const now = playing.current;
      if (now?.token !== token) return;
      playing.current = null;
      if (!now.moment.then) {
        const r = rest.current;
        scheduleOnUI(snap, rig, poseFrame(now.moment.to, r.prop));
        if (now.moment.to !== r.pose) restInPose();
      }
      momentFinished(token);
    };
    const unregister = registerSen(id, {
      play(next, token) {
        const r = rest.current;
        // An ambient beat plays over the pose the Sen rests in, so a blink keeps a revealed grin.
        const moment = isBeat(next.id) ? { ...next, from: r.pose, to: r.pose } : next;
        const from = poseFrame(moment.from, r.prop);
        const m = formFor(moment, r.level, from, poseFrame(moment.to, r.prop));
        playing.current = { token, moment: m };
        beats.current = isBeat(moment.id) ? beats.current + 1 : 0;
        scheduleOnUI(begin, rig, clock, r.full ? fx : null, m, from, r.level, () => end(token));
      },
      settle() {
        playing.current = null;
        cancelAnimation(clock);
        restInPose();
      },
    });
    return () => {
      unregister();
      if (!playing.current) return;
      playing.current = null;
      cancelAnimation(clock);
      restInPose();
    };
  }, [id, rig, clock, fx]);

  // After the registration cleanup, so a settle it queues on the UI thread is stopped too.
  useEffect(
    () => () => {
      scheduleOnUI(stop, rig);
      cancelAnimation(clock);
      cancelAnimation(fx);
    },
    [rig, clock, fx],
  );

  const onPose = useEffectEvent((next: PoseId) => {
    const was = shown.current;
    shown.current = next;
    const moment = was === next ? undefined : transitionFor(was, next);
    if (moment) playMoment(id, moment);
    else if (!playing.current) scheduleOnUI(settle, rig, poseFrame(next, prop), level);
  });
  useEffect(() => onPose(pose), [pose, prop]);

  useEffect(() => {
    const ambient = level === 'off' ? undefined : ambientFor(pose, size);
    if (!ambient) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const beat = nextBeat(ambient, beats.current, Math.random);
      timer = setTimeout(() => {
        playMoment(id, beat.moment);
        schedule();
      }, beat.delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [id, pose, size, level]);

  return (
    <RigDrawing
      rig={rig}
      fx={full ? fx : null}
      size={size}
      label={label}
      surface={surface}
      testID={`sen-rig-${id}`}
    />
  );
}

type DrawingProps = {
  readonly rig: RigValues;
  /** The accent clock, or null for a rig that never pops accents. */
  readonly fx: SharedValue<number> | null;
  readonly size: number;
  readonly label?: string;
  readonly surface: SenAccentTone;
  readonly testID?: string;
};

/** Draws a rig: the four body Views, the coin's SVG nodes, the edge pill and the accent layers. */
export function RigDrawing({ rig, fx, size, label, surface, testID }: DrawingProps): ReactNode {
  const clip = `sen-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { side, inset, unit } = senBox(size);
  const mv = useBody(rig, 'mv', unit);
  const rl = useBody(rig, 'rl', unit);
  const sq = useBody(rig, 'sq', unit);
  const sp = useBody(rig, 'sp', unit);

  return (
    <View
      accessible={label !== undefined}
      accessibilityRole={label === undefined ? undefined : 'image'}
      accessibilityLabel={label}
      importantForAccessibility={label === undefined ? 'no-hide-descendants' : 'yes'}
      testID={testID}
      style={{ width: size, height: size }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -inset, left: -inset, width: side, height: side }}
      >
        <Animated.View testID="sen-mv" style={[FILL, mv]}>
          {fx && <SwooshLayer fx={fx} tone={surface} side={side} />}
          <Animated.View testID="sen-rl" style={[FILL, { transformOrigin: COIN }, rl]}>
            <Animated.View testID="sen-sq" style={[FILL, { transformOrigin: CONTACT }, sq]}>
              <Animated.View testID="sen-sp" style={[FILL, { transformOrigin: COIN }, sp]}>
                <Svg width={side} height={side} viewBox={VIEWBOX}>
                  <Defs>
                    <ClipPath id={clip}>
                      <Circle cx={FACE_CLIP.cx} cy={FACE_CLIP.cy} r={FACE_CLIP.r} />
                    </ClipPath>
                  </Defs>
                  {treeFor(senTier(size)).map((n) => (
                    <RigNode key={n.node} n={n} rig={rig} clip={clip} />
                  ))}
                </Svg>
              </Animated.View>
              <Svg style={FILL} width={side} height={side} viewBox={VIEWBOX}>
                <RigNode n={EDGE_NODE} rig={rig} clip={clip} />
              </Svg>
            </Animated.View>
          </Animated.View>
          {fx && <SparkLayer fx={fx} tone={surface} side={side} />}
        </Animated.View>
      </View>
    </View>
  );
}
