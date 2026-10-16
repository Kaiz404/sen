import type { ReactNode } from 'react';
import { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { Shape } from '../art/geometry';

export function ShapeEl({ shape: s }: { shape: Shape }): ReactNode {
  const paint = {
    fill: s.fill ?? 'none',
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    strokeLinejoin: s.strokeLinejoin,
    strokeDasharray: s.strokeDasharray,
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
