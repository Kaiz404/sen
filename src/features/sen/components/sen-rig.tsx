import {
  type ComponentClass,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  makeMutable,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, ClipPath, Defs, G, type GProps } from 'react-native-svg';

import { type MotionLevel, useMotionPolicy } from '@/motion/policy';
import { playHaptic } from '@/services/haptics';

import { type Channel, type Frame } from '../channels';
import {
  EDGE,
  FACE_CLIP,
  PIVOT,
  senBox,
  senTier,
  transformOrigin,
  VIEWBOX,
} from '../art/geometry';
import type { Matrix } from '../art/matrix';
import { type BodyStyle, NODES, type SvgProps, type TreeNode, treeFor } from '../art/nodes';
import { momentFinished, playMoment, registerSen } from '../director/store';
import { ambientFor, nextBeat, transitionFor } from '../moments';
import { poseFrame, type PoseId, type PropId } from '../poses';
import type { SenProps } from '../sen-props';
import { compileTrack, entry, formFor } from '../timeline/compile';
import type { Moment } from '../timeline/types';
import { ease, makeRig, pick, type RigValues, settle, snap, stop, wrap } from './rig-values';
import { ShapeEl } from './shape';

// RNSVG's native G takes `matrix`, but its JS props type leaves it out.
const AnimatedG = Animated.createAnimatedComponent(
  G as unknown as ComponentClass<GProps & { matrix?: Matrix }>,
);

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

/** Fires a moment's marks and its end from the UI thread, so haptics stay on the frame they belong to. */
function runClock(clock: SharedValue<number>, m: Moment, onEnd: () => void): void {
  let t = 0;
  const NEVER = ReduceMotion.Never;
  const parts = [...m.marks]
    .sort((a, b) => a.at - b.at)
    .map(({ at, haptic }) => {
      const duration = at - t;
      t = at;
      return withTiming(at, { duration, reduceMotion: NEVER }, (done) => {
        'worklet';
        if (done && haptic) scheduleOnRN(playHaptic, haptic);
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

type Rest = { readonly pose: PoseId; readonly prop: PropId | null | undefined; readonly level: MotionLevel };

/**
 * The animated Sen. One shared value per channel, and every part reads only its own, so a still part
 * does no work. It rests in its `pose`. A pose change plays the moment between the two poses when
 * there is one (TRANSITIONS), and eases there otherwise. The director decides what plays.
 */
export function SenRig({ id, pose, size, prop, label }: SenProps & { id: string }): ReactNode {
  const level = useMotionPolicy();
  const [rig] = useState(() => makeRig(poseFrame(pose, prop)));
  const [clock] = useState(() => makeMutable(0));
  const clip = `sen-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { side, inset, unit } = senBox(size);
  const rest = useRef<Rest>({ pose, prop, level });
  const playing = useRef<{ token: number; moment: Moment } | null>(null);
  const shown = useRef(pose);

  useEffect(() => {
    rest.current = { pose, prop, level };
  });

  useEffect(() => {
    const restInPose = () => {
      const r = rest.current;
      settle(rig, poseFrame(r.pose, r.prop), r.level);
    };
    const end = (token: number) => {
      const now = playing.current;
      if (now?.token !== token) return;
      playing.current = null;
      if (!now.moment.then) {
        const r = rest.current;
        snap(rig, poseFrame(now.moment.to, r.prop));
        if (now.moment.to !== r.pose) restInPose();
      }
      momentFinished(token);
    };
    return registerSen(id, {
      play(moment, token) {
        const r = rest.current;
        const from = poseFrame(moment.from, r.prop);
        const m = formFor(moment, r.level, from, poseFrame(moment.to, r.prop));
        playing.current = { token, moment: m };
        stop(rig);
        cancelAnimation(clock);
        wrap(rig);
        for (const [ch, sv] of Object.entries(rig) as [Channel, (typeof rig)[Channel]][]) {
          const steps = m.tracks[ch];
          if (steps) sv.set(compileTrack(entry(steps, sv.get()), m.dur, m.loop));
          else ease(sv, ch, from[ch], r.level);
        }
        if (!m.loop) runClock(clock, m, () => end(token));
      },
      settle() {
        playing.current = null;
        cancelAnimation(clock);
        restInPose();
      },
    });
  }, [id, rig, clock]);

  const onPose = useEffectEvent((next: PoseId) => {
    const was = shown.current;
    shown.current = next;
    const moment = was === next ? undefined : transitionFor(was, next);
    if (moment) playMoment(id, moment);
    else if (!playing.current) settle(rig, poseFrame(next, prop), level);
  });
  useEffect(() => onPose(pose), [pose, prop]);

  useEffect(() => {
    const ambient = level === 'off' ? undefined : ambientFor(pose, size);
    if (!ambient) return;
    let played = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const beat = nextBeat(ambient, played, Math.random);
      timer = setTimeout(() => {
        played++;
        playMoment(id, beat.moment);
        schedule();
      }, beat.delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [id, pose, size, level]);

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
      testID={`sen-rig-${id}`}
      style={{ width: size, height: size }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -inset, left: -inset, width: side, height: side }}
      >
        <Animated.View testID="sen-mv" style={[FILL, mv]}>
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
        </Animated.View>
      </View>
    </View>
  );
}
