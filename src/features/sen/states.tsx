import { type ReactNode, useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { SenLaunch } from './components/sen-launch';
import { SenRig } from './components/sen-rig';
import { playMoment } from './director/store';
import { MOMENTS, transitionFor } from './moments';
import type { PoseId, PropId } from './poses';
import type { MomentId } from './timeline/types';

const LAB = 'lab';

/** The lab holds the start pose this long, so a recording opens on it. */
const LEAD_MS = 600;

/**
 * Plays one moment once, on a hero-size Sen, as the app would: a pose change when the moment is one
 * (Reveal on masked to revealed), otherwise a request and then the end pose.
 */
function MomentLab({ moment, prop }: { moment: MomentId; prop?: PropId }): ReactNode {
  const m = MOMENTS[moment];
  const [pose, setPose] = useState<PoseId>(m.from);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (transitionFor(m.from, m.to) !== moment) playMoment(LAB, moment);
      setPose(m.to);
    }, LEAD_MS);
    return () => clearTimeout(timer);
  }, [m, moment]);

  return (
    <View style={styles.stage}>
      <SenRig id={LAB} pose={pose} prop={prop} size={240} label={`Sen, ${moment}`} />
    </View>
  );
}

/** Lock's hero as the launch hands off to it: the ink panel and the masked Sen at Lock's box. */
function LaunchLab(): ReactNode {
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.52);
  const size = 230;
  const sen = { x: width - size + 34, y: heroHeight - size + 84, size };
  const [done, setDone] = useState(false);

  return (
    <View style={styles.lock}>
      <View style={[styles.hero, { height: heroHeight }]}>
        <View style={{ position: 'absolute', left: sen.x, top: sen.y }}>
          <SenRig id={LAB} pose="masked" size={size} label="Sen, eyes closed while Sen is locked" />
        </View>
      </View>
      {!done && <SenLaunch target={{ sen, heroHeight }} ready onDone={() => setDone(true)} />}
    </View>
  );
}

const lab = (moment: MomentId, prop?: PropId) =>
  function Lab(): ReactNode {
    return <MomentLab moment={moment} prop={prop} />;
  };

/** Each app moment played once on mount, for device flows and recordings (`.maestro/sen-*.yaml`). */
export const SEN_STATES = {
  launch: LaunchLab,
  unlock: lab('unlock'),
  reveal: lab('reveal'),
  remask: lab('remask'),
  'face-scan': lab('faceScan'),
  'auth-failed': lab('authFailed'),
  lockout: lab('lockout'),
  'network-error': lab('networkError', 'plug'),
  refresh: lab('refreshSpin'),
  'empty-search': lab('emptySearch', 'magnifier'),
  copy: lab('copy'),
  'theme-light': lab('themeLight'),
  'theme-dark': lab('themeDark'),
} satisfies Record<string, () => ReactNode>;

const styles = StyleSheet.create((theme) => ({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.canvas,
  },
  lock: { flex: 1, backgroundColor: theme.colors.canvas },
  hero: {
    overflow: 'hidden',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: theme.colors.hero,
  },
}));
