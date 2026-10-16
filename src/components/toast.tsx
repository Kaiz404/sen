import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';

import { EASE } from '@/motion/tokens';

import type { IconName } from './key';

export type ToastAction = {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  /** Defaults to the label. "Undo add" reads better than "Undo" out of context. */
  readonly accessibilityLabel?: string;
};

export type ToastSpec = {
  readonly title: string;
  readonly detail?: string;
  readonly action?: ToastAction;
  /** Milliseconds on screen. */
  readonly ttl?: number;
  /** A small leading mark, such as a face-only Sen. */
  readonly mark?: ReactNode;
};

type Shown = ToastSpec & { readonly id: number; readonly ttl: number };

export const TOAST_TTL = 6000;

const useToasts = create<{ current: Shown | null }>(() => ({ current: null }));
let lastId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** One toast at a time. A new one replaces the current one, which exits as the new one enters. */
export const toast = {
  show(spec: ToastSpec): number {
    const id = ++lastId;
    const ttl = spec.ttl ?? TOAST_TTL;
    clearTimeout(timer);
    useToasts.setState({ current: { ...spec, id, ttl } });
    timer = setTimeout(() => toast.hide(id), ttl);
    return id;
  },
  /** Hides that toast if it is still showing, or whatever is showing when called with no id. */
  hide(id?: number): void {
    const current = useToasts.getState().current;
    if (current === null || (id !== undefined && current.id !== id)) return;
    clearTimeout(timer);
    useToasts.setState({ current: null });
  },
};

const ENTER = FadeInDown.duration(300).easing(EASE.out);
const EXIT = FadeOutDown.duration(250);

export function ToastHost(): ReactNode {
  const current = useToasts((s) => s.current);
  return (
    <View pointerEvents="box-none" style={styles.host}>
      {current !== null && (
        <Animated.View
          key={current.id}
          entering={ENTER}
          exiting={EXIT}
          accessibilityLiveRegion="polite"
          style={styles.toast}
        >
          <View style={styles.row}>
            {current.mark}
            <View style={styles.copy}>
              <Text style={styles.title}>{current.title}</Text>
              {current.detail !== undefined && <Text style={styles.detail}>{current.detail}</Text>}
            </View>
            {current.action !== undefined && <ActionKey id={current.id} action={current.action} />}
          </View>
          <View style={styles.track} aria-hidden>
            <View style={styles.trackBed} />
            <Animated.View style={[styles.fill, drain(current.ttl)]} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function ActionKey({ id, action }: { id: number; action: ToastAction }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      onPress={() => {
        action.onPress();
        toast.hide(id);
      }}
      style={styles.action}
    >
      {action.icon !== undefined && (
        <MaterialCommunityIcons name={action.icon} size={18} color={theme.colors.onPastel} />
      )}
      <Text style={[styles.actionLabel, styles.actionInk]}>{action.label}</Text>
    </Pressable>
  );
}

/** The bar shows time left, so it runs at every motion level. */
function drain(ttl: number) {
  return {
    animationName: { from: { transform: [{ scaleX: 1 }] }, to: { transform: [{ scaleX: 0 }] } },
    animationDuration: ttl,
    animationTimingFunction: 'linear',
  } as const;
}

const styles = StyleSheet.create((theme, rt) => ({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24 + rt.insets.bottom,
  },
  toast: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 64,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: theme.colors.canvas },
  detail: { fontSize: 12, lineHeight: 16, color: theme.colors.canvas, opacity: 0.8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: theme.shape.touchMin,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.lemon,
  },
  actionLabel: { fontSize: 15, fontWeight: '700' },
  actionInk: { color: theme.colors.onPastel },
  track: { height: 4 },
  trackBed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.canvas,
    opacity: 0.16,
  },
  fill: {
    height: 4,
    backgroundColor: theme.colors.lemon,
    transformOrigin: 'left',
  },
}));
