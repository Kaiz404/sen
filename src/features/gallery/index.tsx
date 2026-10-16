import { Link, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useCallback, useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type AuthOverride, isAuthOverride, setAuthOverride } from '@/features/auth';
import { Sen } from '@/features/sen';
import { FrozenMotion } from '@/motion/policy';
import { DbSmoke } from '@/features/stub';
import { readPref } from '@/services/prefs';
import { type } from '@/theme/type';
import { applyTheme } from '@/theme/unistyles';

import { PoseIndex } from './poses';
import {
  type GalleryQuery,
  type Params,
  parseQuery,
  parseTheme,
  shotName,
  type ThemeName,
} from './query';
import { isComponent, SCREENS } from './registry';

function useForcedTheme(theme: ThemeName | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (theme === undefined) return;
      applyTheme(theme);
      return () => applyTheme(readPref('theme'));
    }, [theme]),
  );
}

/** A shot's ready id appears only once the forced theme has applied, so a flow never captures a half-switched frame. */
function useShotId(shot: string | undefined, theme: ThemeName | undefined): string | undefined {
  const { rt } = useUnistyles();
  if (shot === undefined || (theme !== undefined && rt.themeName !== theme)) return undefined;
  return `shot-${shot}`;
}

/** `?auth=pass` makes the next biometric prompts answer without a finger, so device flows can pass Lock. */
function useAuthOverrideParam(params: Params): AuthOverride | undefined {
  const auth =
    typeof params.auth === 'string' && isAuthOverride(params.auth) ? params.auth : undefined;
  useEffect(() => {
    if (auth !== undefined) setAuthOverride(auth);
  }, [auth]);
  return auth;
}

export function StatesScreen(): ReactNode {
  const params = useLocalSearchParams();
  const theme = parseTheme(params);
  useForcedTheme(theme);
  const auth = useAuthOverrideParam(params);
  const focused = useIsFocused();
  const query = parseQuery(params, SCREENS);
  if (auth !== undefined && query.kind === 'index')
    return (
      <View style={styles.screen}>
        <Frame caption={`auth · ${auth}`} shotId={`auth-${auth}`} />
      </View>
    );
  if (query.kind === 'db') return <DbSmoke />;
  return (
    <View style={styles.screen}>
      {focused && (
        <GalleryBody key={`${JSON.stringify(query)} ${theme}`} query={query} theme={theme} />
      )}
    </View>
  );
}

export function GalleryBody({
  query,
  theme,
}: {
  query: Exclude<GalleryQuery, { kind: 'db' }>;
  theme?: ThemeName;
}): ReactNode {
  const shot = shotName(query, theme);
  const shotId = useShotId(shot, theme);
  // The motion lab exists to play motion. Every other state is a settled frame.
  if (query.kind === 'state' && query.screen === 'motion')
    return <Drawn query={query} shotId={shotId} />;
  return (
    <FrozenMotion>
      <Drawn query={query} shotId={shotId} />
    </FrozenMotion>
  );
}

function Drawn({
  query,
  shotId,
}: {
  query: Exclude<GalleryQuery, { kind: 'db' }>;
  shotId: string | undefined;
}): ReactNode {
  switch (query.kind) {
    case 'index':
      return <Index />;
    case 'poses':
      return <PoseIndex />;
    case 'pose':
      return (
        <Frame caption={`sen · ${query.pose} · ${query.size} pt`} shotId={shotId}>
          <View style={styles.centered}>
            <Sen pose={query.pose} size={query.size} label={`Sen, ${query.pose}`} />
          </View>
        </Frame>
      );
    case 'state': {
      const drawn = SCREENS[query.screen]?.[query.state]?.();
      if (!isComponent(query.screen))
        return (
          <View testID={shotId} collapsable={false} style={styles.bleed}>
            {drawn}
          </View>
        );
      return (
        <Frame caption={`${query.screen} · ${query.state}`} shotId={shotId}>
          {drawn}
        </Frame>
      );
    }
    case 'unknown':
      return (
        <Frame caption="not in the gallery">
          <Text style={styles.reason}>{query.reason}</Text>
        </Frame>
      );
  }
}

function Frame({
  caption,
  shotId,
  children,
}: {
  caption: string;
  shotId?: string;
  children?: ReactNode;
}) {
  const { rt } = useUnistyles();
  return (
    <View testID={shotId} collapsable={false} style={styles.frame}>
      <StatusBar style={rt.themeName === 'dark' ? 'light' : 'dark'} />
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

function Index() {
  return (
    <ScrollView contentContainerStyle={styles.index}>
      <Link href={{ pathname: '/dev/states', params: { screen: 'sen' } }} style={styles.link}>
        sen · every pose
      </Link>
      {Object.entries(SCREENS).map(([screen, states]) =>
        Object.keys(states).map((state) => (
          <Link
            key={`${screen}-${state}`}
            href={{ pathname: '/dev/states', params: { screen, state } }}
            style={styles.link}
          >
            {`${screen} · ${state}`}
          </Link>
        )),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  frame: { flex: 1, padding: 20, paddingTop: rt.insets.top + 20, gap: 24 },
  bleed: { flex: 1 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  stage: { flex: 1, justifyContent: 'center' },
  centered: { alignItems: 'center' },
  reason: { ...type.mono(13), color: theme.colors.ink },
  index: { padding: 20, paddingTop: rt.insets.top + 20, gap: 4 },
  link: {
    ...type.mono(14),
    color: theme.colors.ink,
    minHeight: theme.shape.touchMin,
    textAlignVertical: 'center',
  },
}));
