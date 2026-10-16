import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/colors';
import { type } from '@/theme/type';

import type { IconName } from './key';

type TagSpec = {
  readonly label: string;
  readonly tone: ColorToken;
  readonly tilt: number;
  readonly icon?: IconName;
  readonly dashed?: true;
};

/** The small outlined tags the boards use, as a closed set. */
const TAGS = {
  pending: { label: 'PENDING', tone: 'pending', tilt: 0 },
  added: { label: 'ADDED BY YOU', tone: 'stamp', tilt: -3, icon: 'pencil' },
  draft: { label: 'DRAFT · NOT SAVED', tone: 'inkMuted', tilt: -4, dashed: true },
} as const satisfies Record<string, TagSpec>;

export type TagKind = keyof typeof TAGS;
export const TAG_KINDS = Object.keys(TAGS) as TagKind[];

export function Tag({ kind }: { kind: TagKind }): ReactNode {
  const spec: TagSpec = TAGS[kind];
  const { theme } = useUnistyles();
  return (
    <View style={styles.tag(spec)}>
      {spec.icon !== undefined && (
        <MaterialCommunityIcons name={spec.icon} size={11} color={theme.colors[spec.tone]} />
      )}
      <Text style={[styles.label, styles.ink(spec.tone)]}>{spec.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tag: (spec: TagSpec) => ({
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: spec.dashed ? 7 : 5,
    paddingVertical: spec.dashed ? 3 : 1,
    borderWidth: 1.5,
    borderRadius: 4,
    borderStyle: spec.dashed ? 'dashed' : 'solid',
    borderColor: theme.colors[spec.tone],
    transform: [{ rotate: `${spec.tilt}deg` }],
  }),
  label: { ...type.mono(10, 600), letterSpacing: 1 },
  ink: (tone: ColorToken) => ({ color: theme.colors[tone] }),
}));
