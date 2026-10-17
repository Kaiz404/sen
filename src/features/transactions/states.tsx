import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Bone } from '@/components/bone';
import { Key } from '@/components/key';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

import type { ReadFailure, SyncFailure } from './body';

const BONE_ROWS = [0, 1, 2, 3] as const;

/** Bones in the shape of a day slip, under the loading card. */
export function SkeletonSlips(): ReactNode {
  return (
    <View
      testID="history-skeleton"
      accessibilityLabel="Loading your history"
      style={styles.skeleton}
    >
      {[0, 1].map((slip) => (
        <View key={slip} style={styles.boneSlip}>
          <Bone width={120} height={26} radius={6} />
          <View style={styles.bonePaper}>
            {BONE_ROWS.map((row) => (
              <View key={row} style={styles.boneRow}>
                <Bone width={44} height={44} radius={22} />
                <View style={styles.boneText}>
                  <Bone width="70%" height={14} />
                  <Bone width="40%" height={11} />
                </View>
                <Bone width={64} height={16} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyHistory(): ReactNode {
  return (
    <View testID="history-empty" style={styles.state}>
      <Sen pose="idle" size={140} />
      <Text accessibilityRole="header" style={styles.title}>
        Nothing here yet
      </Text>
      <Text style={styles.body}>Pull down to check with your bank, or add one yourself.</Text>
    </View>
  );
}

export function NoResults({
  search,
  onClear,
}: {
  readonly search: string;
  readonly onClear: () => void;
}): ReactNode {
  const term = search.trim();
  return (
    <View testID="history-no-results" style={styles.state}>
      <Sen pose="shrug" prop="magnifier" size={140} label="Sen, shrugging with a magnifier" />
      <Text accessibilityRole="header" style={styles.title}>
        {term === '' ? 'Nothing in this view' : `No “${term}” here`}
      </Text>
      <Text style={styles.body}>
        {term === ''
          ? 'Sen found nothing that matches. Try All.'
          : 'Sen looked through your history and found nothing. Try a merchant, like Grab or TNB.'}
      </Text>
      {term !== '' && (
        <Key tone="paper" icon="close-circle" label="Clear search" onPress={onClear} />
      )}
    </View>
  );
}

const FAILED: Readonly<
  Record<SyncFailure['kind'] | ReadFailure['kind'], readonly [string, string, string]>
> = {
  unreadable: [
    'STORAGE',
    "Sen couldn't read your history",
    'Your saved history is still on this phone. Try reading it again.',
  ],
  offline: [
    'NO CONNECTION',
    "Can't load your history",
    "Sen couldn't reach the server. Check your connection, then try again.",
  ],
  timeout: [
    'TOO SLOW',
    'Taking too long',
    'The server is slow to answer. Your data is safe. Try again in a moment.',
  ],
  storage: [
    'STORAGE',
    "Can't save to this phone",
    "Sen couldn't save to this phone. Free some space, then try again.",
  ],
  unknown: ['UNEXPECTED', 'Something went wrong', "Sen hit a problem it didn't expect. Try again."],
  server: [
    'SERVER ERROR',
    'Something broke on our side',
    "The server sent back an error. It isn't your connection. Try again shortly.",
  ],
};

/** The in-app bank fails these on a reviewer's request. The others are the phone's own. */
const SIMULATED: ReadonlySet<string> = new Set<SyncFailure['kind']>([
  'offline',
  'timeout',
  'server',
]);

export function FullError({
  error,
  onRetry,
  onSettings,
}: {
  readonly error: SyncFailure | ReadFailure;
  readonly onRetry: () => void;
  readonly onSettings: () => void;
}): ReactNode {
  const [caption, title, body] = FAILED[error.kind];
  const simulated = SIMULATED.has(error.kind);
  return (
    <View testID="history-failed" style={styles.failed}>
      <View style={styles.failedSen}>
        <Sen pose="worried" prop="plug" size={176} label="Sen, holding an unplugged cable" />
      </View>
      <View style={styles.failedText}>
        <Text style={styles.caption}>{simulated ? `${caption} · SIMULATED` : caption}</Text>
        <Text accessibilityRole="header" style={styles.failedTitle}>
          {title}
        </Text>
        <Text style={styles.failedBody}>{body}</Text>
      </View>
      <View style={styles.failedActions}>
        <Key tone="lemon" size="large" icon="refresh" label="Retry" onPress={onRetry} />
        {simulated && (
          <Pressable accessibilityRole="link" onPress={onSettings} style={styles.link}>
            <Text style={styles.linkText}>Reviewer settings</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  skeleton: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  boneSlip: { gap: 10 },
  bonePaper: { backgroundColor: theme.colors.paper, paddingVertical: 4 },
  boneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  boneText: { flex: 1, gap: 6 },
  state: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 24,
  },
  failed: { flex: 1, paddingHorizontal: 20, paddingBottom: rt.insets.bottom + 24 },
  failedSen: { position: 'absolute', top: 12, right: -40, transform: [{ scaleX: -1 }] },
  failedText: { marginTop: 196, gap: 14, maxWidth: 300 },
  failedActions: { marginTop: 'auto', gap: 8 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.inkMuted,
    textDecorationLine: 'underline',
  },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  title: { ...type.words(34), textAlign: 'center', color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center', color: theme.colors.inkMuted },
  failedTitle: { ...type.words(60), lineHeight: 52, color: theme.colors.ink },
  failedBody: { fontSize: 16, lineHeight: 23, color: theme.colors.inkMuted },
}));
