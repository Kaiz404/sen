import {
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  use,
  useEffect,
  useState,
} from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as RNScrollView,
  type ScrollViewProps,
  Text,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type GestureType,
  ScrollView,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';

import { cssMs } from '@/components/motion-level';
import { playMoment, releaseSenScroll, Sen, stopMoment } from '@/features/sen';
import { useMotionPolicy } from '@/motion/policy';
import { EASE } from '@/motion/tokens';
import { playHaptic } from '@/services/haptics';
import { type } from '@/theme/type';

import { dragStep, PULL, readiness, stretchFor } from './pull-math';

/** idle: nothing runs. loading: the bank is being asked. landed: the data is back, Sen lands. */
export type PullStatus = 'idle' | 'loading' | 'landed';

/** `refreshLand` runs 120 ms of rise and 1161 ms of drop and wobble (moments/history.ts). */
export const LAND_MS = 1281;
const SEN = 'pull';
const GAP_SEN = 56;
const COLLAPSE_MS = 250;

type ListProps = {
  readonly renderScrollComponent: typeof PullScrollView;
  readonly onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly overScrollMode: 'never';
};

type Props = {
  readonly status: PullStatus;
  readonly onRefresh: () => void;
  /** The landing finished, so the gap may close. */
  readonly onSettled: () => void;
  /** Draws Sen without its motion, so the gallery can shoot a settled frame. */
  readonly still?: boolean;
  readonly children: (list: ListProps) => ReactNode;
};

const PanRef = createContext<RefObject<GestureType | undefined> | null>(null);

/** The list's scroller runs beside the pull, so a normal scroll still scrolls. */
function PullScrollView({
  ref,
  ...props
}: ScrollViewProps & { ref?: Ref<RNScrollView> }): ReactNode {
  const pan = use(PanRef);
  return <ScrollView ref={ref} simultaneousHandlers={pan ?? undefined} {...props} />;
}

/**
 * A custom pull-to-refresh: a gap opens above the list as the finger drags down from the top, Sen stretches out
 * of it, and past 72 pt a release asks the bank. Android's `RefreshControl` is the fallback if the pan fights the
 * list on the phone (PLAN › Spike R1).
 */
export function PullToRefresh({
  status,
  onRefresh,
  onSettled,
  still = false,
  children,
}: Props): ReactNode {
  const level = useMotionPolicy();
  const gap = useSharedValue(0);
  const ready = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const origin = useSharedValue(0);
  const armed = useSharedValue(false);
  const [dragging, setDragging] = useState(false);
  const [labelArmed, setLabelArmed] = useState(false);
  const [panRef] = useState<RefObject<GestureType | undefined>>(() => ({ current: undefined }));
  const idle = status === 'idle';

  const collapseMs = cssMs(level, COLLAPSE_MS);
  const settle = (to: number) => {
    'worklet';
    return collapseMs === 0 ? to : withTiming(to, { duration: collapseMs, easing: EASE.out });
  };
  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: gap.get() }] }));

  const pan = Gesture.Pan()
    .withRef(panRef)
    .withTestId('history-pull')
    .enabled(idle)
    .activeOffsetY(8)
    .failOffsetY(-8)
    .onStart(() => {
      origin.set(0);
      scheduleOnRN(setDragging, true);
    })
    .onUpdate((e) => {
      const next = dragStep(origin.get(), e.translationY, scrollY.get());
      origin.set(next.origin);
      gap.set(next.gap);
      ready.set(readiness(next.gap));
      if (next.armed !== armed.get()) {
        armed.set(next.armed);
        scheduleOnRN(setLabelArmed, next.armed);
        if (next.armed) scheduleOnRN(playHaptic, 'refreshThreshold');
      }
    })
    .onFinalize((_e, success) => {
      const go = success && armed.get();
      armed.set(false);
      scheduleOnRN(setLabelArmed, false);
      scheduleOnRN(setDragging, false);
      ready.set(settle(0));
      if (go) {
        gap.set(settle(PULL.hold));
        scheduleOnRN(onRefresh);
      } else {
        gap.set(settle(0));
      }
    });

  useEffect(() => {
    gap.set(settle(idle ? 0 : PULL.hold));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, level]);

  useEffect(() => {
    if (status !== 'landed') return;
    const timer = setTimeout(onSettled, LAND_MS);
    return () => clearTimeout(timer);
  }, [status, onSettled]);

  return (
    <PanRef value={panRef}>
      <GestureDetector gesture={pan}>
        <View style={styles.frame}>
          <PullGap
            gap={gap}
            ready={ready}
            status={status}
            still={still}
            dragging={dragging}
            armed={labelArmed}
          />
          <Animated.View style={[styles.list, listStyle]}>
            {children({
              renderScrollComponent: PullScrollView,
              onScroll: (e) => scrollY.set(e.nativeEvent.contentOffset.y),
              overScrollMode: 'never',
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </PanRef>
  );
}

const LABEL: Readonly<Record<PullStatus, string>> = {
  idle: 'PULL TO REFRESH',
  loading: 'CHECKING WITH YOUR BANK',
  landed: 'UP TO DATE',
};

export function PullGap({
  gap,
  ready,
  status,
  still,
  dragging,
  armed,
}: {
  readonly gap: { get: () => number };
  readonly ready: { get: () => number };
  readonly status: PullStatus;
  readonly still: boolean;
  readonly dragging: boolean;
  readonly armed: boolean;
}): ReactNode {
  const open = dragging || status !== 'idle';
  const box = useAnimatedStyle(() => ({ height: gap.get() }));
  const sen = useAnimatedStyle(() => {
    const { sx, sy } = stretchFor(ready.get());
    return { transform: [{ translateY: (1 - ready.get()) * 40 }, { scaleX: sx }, { scaleY: sy }] };
  });

  useEffect(() => {
    if (status === 'loading') {
      releaseSenScroll();
      playMoment(SEN, 'refreshSpin');
    } else if (status === 'landed') {
      // The moment buzzes at the touchdown. Without one, the landing still buzzes, once.
      if (!playMoment(SEN, 'refreshLand')) playHaptic('refreshLanded');
    }
    return () => stopMoment(SEN);
  }, [status]);

  return (
    <Animated.View testID="pull-gap" style={[styles.gap, box]}>
      {open && (
        <>
          <Text style={styles.label}>
            {status === 'idle' && armed ? 'RELEASE TO REFRESH' : LABEL[status]}
          </Text>
          <Animated.View style={[styles.sen, status === 'idle' && sen]}>
            {status === 'idle' || still ? (
              <Sen pose="idle" size={GAP_SEN} />
            ) : (
              <Sen id={SEN} pose="idle" size={GAP_SEN} label="Sen, checking with your bank" />
            )}
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  frame: { flex: 1 },
  list: { flex: 1 },
  gap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.chip,
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.leader,
  },
  label: {
    ...type.caption(11),
    position: 'absolute',
    left: 20,
    top: 14,
    color: theme.colors.inkMuted,
  },
  sen: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
}));
