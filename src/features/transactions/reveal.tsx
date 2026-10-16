import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { type StyleProp, Text, type TextStyle, View } from 'react-native';
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Amount, type AmountSurface } from '@/components/amount';
import type { DayKey } from '@/models/day';
import {
  type Direction,
  type Minor,
  moneyParts,
  moneySpoken,
  type SignedMinor,
  type SignMode,
} from '@/models/money';
import type { TxId } from '@/models/transaction';
import { type MotionLevel, useMotionPolicy } from '@/motion/policy';
import { DUR, EASE } from '@/motion/tokens';
import type { RevealedTotals } from '@/services/tx-repo';
import { type } from '@/theme/type';

/**
 * Everything the screen shows while amounts are shown. It exists only then: while hidden the screen holds null and
 * no amount from the database is in JS.
 */
export type Revealed = {
  readonly amounts: ReadonlyMap<TxId, Minor>;
  readonly nets?: ReadonlyMap<DayKey, SignedMinor>;
  readonly month?: RevealedTotals;
  readonly results?: RevealedTotals;
};

const RevealedContext = createContext<Revealed | null>(null);
const ProgressContext = createContext<SharedValue<number> | null>(null);

/** The board's reveal: the digits start rolling 200 ms after the amounts arrive. */
export const ROLL = { delay: 200, duration: 520 } as const;

function rollTo1(level: MotionLevel): number {
  switch (level) {
    case 'full':
      return withDelay(ROLL.delay, withTiming(1, { duration: ROLL.duration, easing: EASE.out }));
    case 'calm':
      return withTiming(1, {
        duration: DUR.calm,
        easing: EASE.linear,
        reduceMotion: ReduceMotion.Never,
      });
    case 'off':
      return 1;
  }
}

/**
 * Hands the revealed amounts to every row and holds the one shared value that rolls their digits in. Rows re-render
 * once when the amounts arrive or leave. The roll itself runs on the UI thread with no render.
 */
export function RevealedAmounts({
  value,
  children,
}: {
  readonly value: Revealed | null;
  readonly children: ReactNode;
}): ReactNode {
  const progress = useSharedValue(0);
  const level = useMotionPolicy();
  const shown = value !== null;

  useEffect(() => {
    progress.set(shown ? rollTo1(level) : 0);
  }, [shown, level, progress]);

  return (
    <ProgressContext value={progress}>
      <RevealedContext value={value}>{children}</RevealedContext>
    </ProgressContext>
  );
}

export function useRevealed(): Revealed | null {
  return use(RevealedContext);
}

/** A row's amount. Null while hidden, and null until the amounts for the loaded rows arrive. */
export function useAmountView(id: TxId): Minor | null {
  return use(RevealedContext)?.amounts.get(id) ?? null;
}

export function useDayNetView(day: DayKey): SignedMinor | null {
  return use(RevealedContext)?.nets?.get(day) ?? null;
}

function useRevealProgress(): SharedValue<number> {
  const progress = use(ProgressContext);
  if (progress === null) throw new Error('A rolling amount sits inside <RevealedAmounts>.');
  return progress;
}

/** Column `col` of `cols` at overall progress `p`. Columns start in turn and all land together at 1. */
export function digitStyle(p: number, col: number, cols: number) {
  'worklet';
  const stagger = cols > 1 ? Math.min(0.06, 0.5 / (cols - 1)) : 0;
  const local = Math.min(Math.max((p - col * stagger) / (1 - (cols - 1) * stagger), 0), 1);
  return { opacity: local, transform: [{ translateY: (1 - local) * 10 }] };
}

export type RollSize = 'hero' | 'card' | 'row' | 'net';

type RollScale = {
  readonly lead: TextStyle;
  readonly whole: TextStyle;
  readonly fraction: TextStyle;
  readonly leadGap: number;
};

const SCALE: Readonly<Record<RollSize, RollScale>> = {
  hero: {
    lead: { ...type.words(30), letterSpacing: 0 },
    whole: { ...type.numerals(96), lineHeight: 96 },
    fraction: { ...type.numerals(40), letterSpacing: 0 },
    leadGap: 6,
  },
  card: {
    lead: type.numerals(26),
    whole: type.numerals(26),
    fraction: type.numerals(16),
    leadGap: 2,
  },
  row: {
    lead: type.numerals(19),
    whole: type.numerals(19),
    fraction: type.numerals(13),
    leadGap: 2,
  },
  net: {
    lead: type.mono(13, 600),
    whole: type.mono(13, 600),
    fraction: type.mono(13, 600),
    leadGap: 2,
  },
};

function Column({
  col,
  cols,
  style,
  children,
}: {
  readonly col: number;
  readonly cols: number;
  readonly style: StyleProp<TextStyle>;
  readonly children: string;
}): ReactNode {
  const progress = useRevealProgress();
  const roll = useAnimatedStyle(() => digitStyle(progress.get(), col, cols));
  return (
    <Animated.View testID="digit-column" style={roll}>
      <Text style={style}>{children}</Text>
    </Animated.View>
  );
}

/** A whole amount on one animated view. A list mounts many of these, and one view per digit made scrolling stall. */
function Rolling({ label, children }: { readonly label: string; readonly children: ReactNode }): ReactNode {
  const progress = useRevealProgress();
  const roll = useAnimatedStyle(() => digitStyle(progress.get(), 0, 1));
  return (
    <Animated.View
      testID="amount-roll"
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.row, roll]}
    >
      {children}
    </Animated.View>
  );
}

type RollAmountProps = {
  readonly value: SignedMinor | null;
  readonly size: RollSize;
  readonly surface?: AmountSurface;
  readonly sign?: SignMode;
  readonly direction?: Direction;
};

/** Four coins while masked. Shown, the hero rolls in digit by digit and smaller amounts roll in whole, on the shared progress. */
export function RollAmount({
  value,
  size,
  surface = 'plain',
  sign = 'auto',
  direction,
}: RollAmountProps): ReactNode {
  if (value === null) {
    return <Amount value={null} size={size} surface={surface} sign={sign} direction={direction} />;
  }
  const scale = SCALE[size];
  const parts = moneyParts(value, sign);
  const ink = styles.ink(surface, value > 0);
  const lead = `${parts.sign}${parts.currency}`;
  if (size !== 'hero') {
    return (
      <Rolling label={moneySpoken(value, sign)}>
        <Text style={[scale.lead, ink, { marginRight: scale.leadGap }]}>{lead}</Text>
        <Text style={[scale.whole, ink]}>{parts.whole}</Text>
        <Text style={[scale.fraction, ink]}>{parts.fraction}</Text>
      </Rolling>
    );
  }
  const chars = [...parts.whole, ...parts.fraction];
  const cols = chars.length + 1;
  const amount = (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={moneySpoken(value, sign)}
      style={styles.row}
    >
      <Column col={0} cols={cols} style={[scale.lead, ink, { marginRight: scale.leadGap }]}>
        {lead}
      </Column>
      {chars.map((char, i) => (
        <Column
          key={i}
          col={i + 1}
          cols={cols}
          style={[i < parts.whole.length ? scale.whole : scale.fraction, ink]}
        >
          {char}
        </Column>
      ))}
    </View>
  );
  return size === 'hero' ? <FitWidth>{amount}</FitWidth> : amount;
}

type Size = { readonly width: number; readonly height: number };

/** Scales a hero amount down to the card's width, so the sen digits of a large total never clip. */
export function FitWidth({ children }: { readonly children: ReactNode }): ReactNode {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState<Size | null>(null);
  const scale = content !== null && box > 0 && content.width > box ? box / content.width : 1;
  return (
    <View
      testID="fit-box"
      onLayout={(e) => setBox(e.nativeEvent.layout.width)}
      style={styles.fitBox(content === null ? undefined : content.height * scale)}
    >
      <View
        testID="fit-content"
        onLayout={(e) => setContent(e.nativeEvent.layout)}
        style={styles.fitContent(scale)}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  fitBox: (height: number | undefined) => ({
    flexDirection: 'row',
    alignItems: 'flex-end',
    height,
  }),
  fitContent: (scale: number) => ({
    transformOrigin: 'left bottom',
    transform: [{ scale }],
  }),
  ink: (surface: AmountSurface, credit: boolean) => ({
    color:
      surface === 'loud'
        ? theme.colors.onLoud
        : surface === 'pastel'
          ? theme.colors.onPastel
          : credit
            ? theme.colors.deep
            : theme.colors.ink,
  }),
}));
