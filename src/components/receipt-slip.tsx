import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

const EDGE = 8;
const BITE = { pitch: 14, r: 4 } as const;
const TOOTH = { pitch: 11, depth: 7.78, notch: 2.28 } as const;
/** Wider than any phone, so the edges never need a measured width. Both pitches divide it. */
const SPAN = 616;

/** Paper strip with semicircle bites cut from its top edge, as the board's `.perf`. */
export function perforation(width: number): string {
  let d = 'M0,0';
  for (let cx = BITE.pitch / 2; cx + BITE.r <= width; cx += BITE.pitch)
    d += ` L${cx - BITE.r},0 A${BITE.r},${BITE.r} 0 0 0 ${cx + BITE.r},0`;
  return `${d} L${width},0 V${EDGE} H0 Z`;
}

/** Paper strip whose bottom edge is a row of teeth, as the board's `.zig`. */
export function zigzag(width: number): string {
  let d = `M0,0 H${width}`;
  for (let x = width; x > 0; x -= TOOTH.pitch)
    d += ` L${x},${TOOTH.depth} L${x - TOOTH.pitch / 2},${TOOTH.notch}`;
  return `${d} L0,${TOOTH.depth} Z`;
}

const PERFORATION = perforation(SPAN);
const ZIGZAG = zigzag(SPAN);

const PaperPath = withUnistyles(Path, (theme) => ({ fill: theme.colors.paper }));
const RuleLine = withUnistyles(Line, (theme) => ({ stroke: theme.colors.rule }));
const LeaderLine = withUnistyles(Line, (theme) => ({ stroke: theme.colors.leader }));

function Edge({ d }: { d: string }) {
  return (
    <View style={styles.edge} aria-hidden>
      <Svg width={SPAN} height={EDGE}>
        <PaperPath d={d} />
      </Svg>
    </View>
  );
}

/** A receipt slip: perforated top, paper body, zigzag bottom. Children lay out in the body. */
export function ReceiptSlip({ children }: { children: ReactNode }): ReactNode {
  return (
    <View>
      <Edge d={PERFORATION} />
      <View style={styles.body}>{children}</View>
      <Edge d={ZIGZAG} />
    </View>
  );
}

/** The dashed rule between slip rows. */
export function SlipRule(): ReactNode {
  return (
    <View style={styles.rule} aria-hidden>
      <Svg width={SPAN} height={2}>
        <RuleLine x1={0} y1={1} x2={SPAN} y2={1} strokeWidth={1.5} strokeDasharray="4 3" />
      </Svg>
    </View>
  );
}

/** Dotted leader that fills a row between a label and a total. */
export function Leader(): ReactNode {
  return (
    <View style={styles.leader} aria-hidden>
      <Svg width={SPAN} height={2}>
        <LeaderLine
          x1={1}
          y1={1}
          x2={SPAN}
          y2={1}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="0 4"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  edge: { height: EDGE, overflow: 'hidden' },
  body: { backgroundColor: theme.colors.paper },
  rule: { height: 2, overflow: 'hidden' },
  leader: {
    flex: 1,
    minWidth: 12,
    height: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
    transform: [{ translateY: -4 }],
  },
}));
