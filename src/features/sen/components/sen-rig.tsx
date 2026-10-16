import { type ComponentClass, type ReactNode, useEffect, useEffectEvent, useId, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, type GProps } from 'react-native-svg';

import { useMotionPolicy } from '@/motion/policy';

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
import { poseFrame } from '../poses';
import type { SenProps } from '../sen-props';
import { makeRig, pick, type RigValues, settle } from './rig-values';
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

/**
 * The animated Sen. One shared value per channel, and every part reads only its own, so a still part
 * does no work. It rests in its `pose`, and eases there when the pose changes.
 */
export function SenRig({ id, pose, size, prop, label }: SenProps & { id: string }): ReactNode {
  const level = useMotionPolicy();
  const [rig] = useState(() => makeRig(poseFrame(pose, prop)));
  const clip = `sen-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { side, inset, unit } = senBox(size);

  const restIn = useEffectEvent((frame: Frame) => settle(rig, frame, level));
  useEffect(() => restIn(poseFrame(pose, prop)), [pose, prop]);

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
