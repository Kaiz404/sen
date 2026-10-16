import { Link, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { Sen } from '@/features/sen';
import { DbSmoke } from '@/features/stub';
import { type } from '@/theme/type';

import { PoseIndex } from './poses';
import { type GalleryQuery, parseQuery, parseTheme, shotName, type ThemeName } from './query';
import { SCREENS } from './registry';

/**
 * Forces a theme while this screen has focus. React Navigation blurs the old screen before it focuses the
 * new one, so a stacked gallery screen hands the theme over in order.
 */
function useForcedTheme(theme: ThemeName | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (theme === undefined) return;
      UnistylesRuntime.setAdaptiveThemes(false);
      UnistylesRuntime.setTheme(theme);
      return () => UnistylesRuntime.setAdaptiveThemes(true);
    }, [theme]),
  );
}

export function StatesScreen(): ReactNode {
  const params = useLocalSearchParams();
  const theme = parseTheme(params);
  useForcedTheme(theme);
  const focused = useIsFocused();
  const query = parseQuery(params, SCREENS);
  if (query.kind === 'db') return <DbSmoke />;
  return (
    <View style={styles.screen}>
      {focused && (
        <GalleryBody key={`${JSON.stringify(query)} ${theme}`} query={query} theme={theme} />
      )}
    </View>
  );
}

/**
 * Draws one query. A new link can reuse this screen with new params, so the body is keyed by its query and
 * each state mounts fresh. Unfocused gallery screens draw nothing, so a toast never leaks into the next.
 */
export function GalleryBody({
  query,
  theme,
}: {
  query: Exclude<GalleryQuery, { kind: 'db' }>;
  theme?: ThemeName;
}): ReactNode {
  const shot = shotName(query, theme);
  switch (query.kind) {
    case 'index':
      return <Index />;
    case 'poses':
      return <PoseIndex />;
    case 'pose':
      return (
        <Frame caption={`sen · ${query.pose} · ${query.size} pt`} shot={shot}>
          <Sen pose={query.pose} size={query.size} label={`Sen, ${query.pose}`} />
        </Frame>
      );
    case 'state':
      return (
        <Frame caption={`${query.screen} · ${query.state}`} shot={shot}>
          {SCREENS[query.screen]?.[query.state]?.()}
        </Frame>
      );
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
  shot,
  children,
}: {
  caption: string;
  shot?: string;
  children: ReactNode;
}) {
  return (
    <View testID={shot && `shot-${shot}`} style={styles.frame}>
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
  screen: { flex: 1, backgroundColor: theme.colors.canvas, paddingTop: rt.insets.top },
  frame: { flex: 1, padding: 20, gap: 24 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  stage: { flex: 1, justifyContent: 'center' },
  reason: { ...type.mono(13), color: theme.colors.ink },
  index: { padding: 20, gap: 4 },
  link: {
    ...type.mono(14),
    color: theme.colors.ink,
    minHeight: theme.shape.touchMin,
    textAlignVertical: 'center',
  },
}));
