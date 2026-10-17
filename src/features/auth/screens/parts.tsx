import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { IconName } from '@/components/key';
import { type LaunchTarget, Sen, type SenProps } from '@/features/sen';
import { type } from '@/theme/type';

export type { IconName };

const HERO = {
  welcome: { title: 96, gap: 20, body: 168, sen: { size: 196, right: 2, bottom: -66 } },
  lock: { title: 84, gap: 22, body: 178, sen: { size: 230, right: -34, bottom: -84 } },
} as const;

type HeroProps = {
  readonly kind: keyof typeof HERO;
  readonly title: readonly [string, string];
  readonly body: string;
  readonly sen?: Omit<SenProps, 'size'>;
  /** Hears where the hero draws its Sen, in window points. The hero sits at the window's top left. */
  readonly onLaunchTarget?: (target: LaunchTarget) => void;
};

export function Hero({ kind, title, body, sen, onLaunchTarget }: HeroProps): ReactNode {
  const layout = HERO[kind];
  const { size, right, bottom } = layout.sen;
  return (
    <View
      testID="hero"
      style={[styles.hero, { gap: layout.gap }]}
      onLayout={
        onLaunchTarget &&
        (({ nativeEvent: { layout: box } }) =>
          onLaunchTarget({
            sen: { x: box.width - right - size, y: box.height - bottom - size, size },
            heroHeight: box.height,
          }))
      }
    >
      <Brand />
      <Text
        accessibilityRole="header"
        accessibilityLabel={title.join(' ')}
        adjustsFontSizeToFit
        numberOfLines={2}
        style={styles.title(layout.title)}
      >
        {title[0]}
        {'\n'}
        <Text style={styles.titleAccent}>{title[1]}</Text>
      </Text>
      <Text style={[styles.body, { maxWidth: layout.body }]}>{body}</Text>
      {sen !== undefined && (
        <View style={[styles.sen, { right: layout.sen.right, bottom: layout.sen.bottom }]}>
          <Sen {...sen} size={layout.sen.size} />
        </View>
      )}
    </View>
  );
}

export function Brand(): ReactNode {
  return (
    <View style={styles.brand}>
      <Text style={styles.wordmark}>Sen</Text>
      <Text style={styles.badge}>DEMO BUILD · SIMULATED DATA</Text>
    </View>
  );
}

export function TextLink({
  label,
  onPress,
  onHero = false,
  disabled = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly onHero?: boolean;
  readonly disabled?: boolean;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.link}
    >
      <Text style={[styles.linkLabel, onHero && styles.linkOnHero]}>{label}</Text>
    </Pressable>
  );
}

export function ProfileRow(): ReactNode {
  return (
    <View style={styles.profile}>
      <Text accessible={false} style={styles.avatar}>
        DU
      </Text>
      <View style={styles.profileText}>
        <Text style={styles.profileName}>Demo user</Text>
        <Text style={styles.muted}>Everyday Savings ·· 4821</Text>
      </View>
      <Text style={styles.pill}>SIMULATED</Text>
    </View>
  );
}

export function Notice({ text }: { readonly text: string }): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View accessibilityLiveRegion="polite" accessible style={styles.notice}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={theme.colors.stamp} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function Note({ text }: { readonly text: string }): ReactNode {
  return <Text style={styles.note}>{text}</Text>;
}

export function NoteCard({ icon, text }: { readonly icon: IconName; readonly text: string }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.noteCard}>
      <View accessible={false} style={styles.noteTile}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.colors.onPastel} />
      </View>
      <Text style={styles.noteCardText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  // Grows to fill the screen but never shrinks below its copy. The screen scrolls when the actions need the room.
  hero: {
    flexGrow: 1,
    minHeight: 300,
    paddingTop: rt.insets.top + 26,
    paddingHorizontal: 22,
    paddingBottom: 24,
    overflow: 'hidden',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: theme.colors.hero,
  },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { ...type.words(30), color: theme.colors.lemon },
  badge: {
    ...type.caption(10),
    color: theme.colors.onHeroMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.onHeroMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  title: (size: number) => ({
    ...type.words(size),
    lineHeight: Math.round(size * 0.84),
    color: theme.colors.onHero,
  }),
  titleAccent: { color: theme.colors.lemon },
  body: { fontSize: 15, lineHeight: 21, color: theme.colors.onHeroMuted },
  sen: { position: 'absolute' },
  link: {
    minHeight: theme.shape.touchMin,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.inkMuted,
    textDecorationLine: 'underline',
  },
  linkOnHero: { color: theme.colors.onHeroMuted },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.mint,
    backgroundColor: theme.colors.paper,
  },
  avatar: {
    ...type.numerals(18),
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 48,
    color: theme.colors.onPastel,
    backgroundColor: theme.colors.lilac,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  muted: { fontSize: 13, color: theme.colors.inkMuted },
  pill: {
    ...type.caption(10),
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    color: theme.colors.onPastel,
    backgroundColor: theme.colors.mint,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.stamp,
    backgroundColor: theme.colors.paper,
  },
  noticeText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  note: {
    marginHorizontal: 4,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: theme.colors.inkMuted,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.leader,
    backgroundColor: theme.colors.paper,
  },
  noteTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.mint,
  },
  noteCardText: { flex: 1, fontSize: 14, lineHeight: 19, color: theme.colors.ink },
}));
