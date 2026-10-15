import { memo, type ReactNode, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { Frame } from '../channels';
import {
  FACE_CLIP,
  PIVOT,
  type Shape,
  senBox,
  senTier,
  transformOrigin,
  VIEWBOX,
} from '../art/geometry';
import { NODES, type TreeNode, treeFor } from '../art/nodes';
import { poseFrame } from '../poses';
import type { SenProps } from '../sen-props';

function ShapeEl({ shape: s }: { shape: Shape }): ReactNode {
  const paint = {
    fill: s.fill ?? 'none',
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    opacity: s.opacity,
  };
  switch (s.kind) {
    case 'circle':
      return <Circle cx={s.cx} cy={s.cy} r={s.r} {...paint} />;
    case 'ellipse':
      return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...paint} />;
    case 'rect':
      return (
        <Rect
          x={s.x}
          y={s.y}
          width={s.width}
          height={s.height}
          rx={s.rx}
          transform={s.rotate ? `rotate(${s.rotate.join(' ')})` : undefined}
          {...paint}
        />
      );
    case 'path':
      return <Path d={s.d} strokeLinecap="round" {...paint} />;
  }
}

function Node({ n, frame, clip }: { n: TreeNode; frame: Frame; clip: string }): ReactNode {
  const { opacity, matrix } = NODES[n.node].read(frame, 1);
  if (opacity === 0) return null;
  const group = (
    <G
      testID={`sen-${n.node}`}
      opacity={opacity}
      transform={matrix && [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]]}
    >
      {n.children?.map((child) => (
        <Node key={child.node} n={child} frame={frame} clip={clip} />
      ))}
      {n.shapes?.map((shape, i) => (
        <ShapeEl key={i} shape={shape} />
      ))}
    </G>
  );
  return n.clip ? <G clipPath={`url(#${clip})`}>{group}</G> : group;
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const COIN = transformOrigin(PIVOT.coin);
const CONTACT = transformOrigin(PIVOT.contact);

export const SenStatic = memo(function SenStatic({
  pose,
  size,
  prop,
  label,
}: Omit<SenProps, 'id'>): ReactNode {
  const clip = `sen-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const frame = poseFrame(pose, prop);
  const { side, inset, unit } = senBox(size);

  return (
    <View
      accessible={label !== undefined}
      accessibilityRole={label === undefined ? undefined : 'image'}
      accessibilityLabel={label}
      importantForAccessibility={label === undefined ? 'no-hide-descendants' : 'yes'}
      style={{ width: size, height: size }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -inset, left: -inset, width: side, height: side }}
      >
        <View testID="sen-mv" style={[FILL, NODES.mv.read(frame, unit)]}>
          <View
            testID="sen-rl"
            style={[FILL, { transformOrigin: COIN }, NODES.rl.read(frame, unit)]}
          >
            <View
              testID="sen-sq"
              style={[FILL, { transformOrigin: CONTACT }, NODES.sq.read(frame, unit)]}
            >
              <View
                testID="sen-sp"
                style={[FILL, { transformOrigin: COIN }, NODES.sp.read(frame, unit)]}
              >
                <Svg width={side} height={side} viewBox={VIEWBOX}>
                  <Defs>
                    <ClipPath id={clip}>
                      <Circle cx={FACE_CLIP.cx} cy={FACE_CLIP.cy} r={FACE_CLIP.r} />
                    </ClipPath>
                  </Defs>
                  {treeFor(senTier(size)).map((n) => (
                    <Node key={n.node} n={n} frame={frame} clip={clip} />
                  ))}
                </Svg>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});
