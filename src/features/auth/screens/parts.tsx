import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Sen, type SenProps } from '@/features/sen';
import { type } from '@/theme/type';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type HeroProps = {
  readonly title: readonly [string, string];
  readonly body: string;
  readonly sen?: SenProps;
};

/** The ink hero on Welcome and Lock. The second title line is lemon. */
export function Hero({ title, body, sen }: HeroProps): ReactNode {
  return (
    <View style={styles.hero}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>Sen</Text>
        <Text style={styles.badge}>DEMO BUILD · SIMULATED DATA</Text>
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLabel={title.join(' ')}
        adjustsFontSizeToFit
        numberOfLines={2}
        style={styles.title}
      >
        {title[0]}
        {'\n'}
        <Text style={styles.titleAccent}>{title[1]}</Text>
      </Text>
      <Text style={styles.body}>{body}</Text>
      {sen !== undefined && (
        <View style={styles.sen}>
          <Sen {...sen} />
        </View>
      )}
    </View>
  );
}

type KeyProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly tone?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly testID?: string;
};

/** A stand-in for the shared Key primitive: the face drops onto its shadow plate while pressed. */
export function Key({
  label,
  onPress,
  icon,
  tone = 'primary',
  disabled = false,
  testID,
}: KeyProps): ReactNode {
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={primary ? styles.keyFrame : undefined}
    >
      {({ pressed }) => (
        <>
          {primary && <View style={styles.keyPlate} />}
          <View
            style={[
              primary ? styles.primaryFace : styles.secondaryFace,
              primary && pressed && styles.pressedFace,
              disabled && styles.disabledFace,
            ]}
          >
            {icon !== undefined && (
              <MaterialCommunityIcons name={icon} size={primary ? 24 : 20} style={styles.keyIcon} />
            )}
            <Text style={primary ? styles.primaryLabel : styles.secondaryLabel}>{label}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

export function TextLink({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}): ReactNode {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Text style={styles.linkLabel}>{label}</Text>
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

/** An inline message after a prompt fails. Screen readers hear it as it appears. */
export function Notice({
  text,
  icon,
}: {
  readonly text: string;
  readonly icon: IconName;
}): ReactNode {
  return (
    <View accessibilityLiveRegion="polite" accessible style={styles.notice}>
      <MaterialCommunityIcons name={icon} size={22} style={styles.noticeIcon} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function Note({ text }: { readonly text: string }): ReactNode {
  return <Text style={styles.note}>{text}</Text>;
}

const styles = StyleSheet.create((theme, rt) => {
  const { keyBorder, keyShadow, keyRadius, touchMin } = theme.shape;

  return {
    hero: {
      flex: 1,
      minHeight: 300,
      paddingTop: rt.insets.top + 26,
      paddingHorizontal: 22,
      gap: 22,
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
    title: { ...type.words(84), lineHeight: 72, color: theme.colors.onHero },
    titleAccent: { color: theme.colors.lemon },
    body: { maxWidth: 178, fontSize: 15, lineHeight: 21, color: theme.colors.onHeroMuted },
    sen: { position: 'absolute', right: -24, bottom: -72 },
    keyFrame: { paddingBottom: keyShadow },
    keyPlate: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: keyShadow,
      bottom: 0,
      borderRadius: keyRadius + 2,
      backgroundColor: theme.colors.onPastel,
    },
    primaryFace: {
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: keyRadius + 2,
      borderWidth: keyBorder,
      borderColor: theme.colors.onPastel,
      backgroundColor: theme.colors.lemon,
    },
    pressedFace: { transform: [{ translateY: keyShadow }] },
    secondaryFace: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: keyRadius,
      borderWidth: keyBorder,
      borderColor: theme.colors.ink,
    },
    disabledFace: { opacity: 0.55 },
    keyIcon: { color: theme.colors.onPastel },
    primaryLabel: { ...type.words(19), color: theme.colors.onPastel },
    secondaryLabel: { ...type.words(17), color: theme.colors.ink },
    link: {
      minHeight: touchMin,
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
      ...type.words(18),
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
      padding: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.paper,
    },
    noticeIcon: { color: theme.colors.danger },
    noticeText: {
      flex: 1,
      fontSize: 14,
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
  };
});
