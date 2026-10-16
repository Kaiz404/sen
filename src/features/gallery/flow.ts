import { POSE_IDS } from '@/features/sen';

import { SEN_SIZES } from './poses';
import { shotName } from './query';
import type { ScreenStates } from './registry';

export type Shot = { readonly name: string; readonly link: string };

/** One Maestro flow in `.maestro/gallery/`, named so `--shots` globs pick a screen, a theme or a pose. */
export type ShotFlow = { readonly name: string; readonly shots: readonly Shot[] };

const LINK = 'sen://dev/states';
const THEMES = ['light', 'dark'] as const;

/** Every screenshot the gallery owes: one flow per screen and theme, then one per pose at every size. */
export function shotFlows(screens: Readonly<Record<string, ScreenStates>>): ShotFlow[] {
  const states = Object.entries(screens).flatMap(([screen, byState]) =>
    THEMES.map((theme) => ({
      name: `${screen}-${theme}`,
      shots: Object.keys(byState).map((state) => ({
        name: shotName({ kind: 'state', screen, state }, theme)!,
        link: `${LINK}?screen=${screen}&state=${state}&theme=${theme}`,
      })),
    })),
  );
  const poses = POSE_IDS.map((pose) => ({
    name: `pose-${pose}`,
    shots: SEN_SIZES.map((size) => ({
      name: shotName({ kind: 'pose', pose, size }, 'light')!,
      link: `${LINK}?screen=sen&pose=${pose}&size=${size}&theme=light`,
    })),
  }));
  return [...states, ...poses];
}

export function flowYaml(flow: ShotFlow): string {
  const steps = flow.shots.map(
    (s, i) =>
      `- openLink: "${s.link}"\n` +
      // The first link of a run may wait for Metro to send the bundle.
      `- extendedWaitUntil:\n    visible:\n      id: shot-${s.name}\n    timeout: ${i === 0 ? 120000 : 15000}\n` +
      `- waitForAnimationToEnd:\n    timeout: 3000\n` +
      `- takeScreenshot: ${s.name}\n`,
  );
  return [
    '# Generated from src/features/gallery by flow.test.ts. Run UPDATE_FLOW=1 npx jest gallery/flow to refresh.\n',
    'appId: com.kaiz404.sen\n',
    '---\n',
    ...steps,
  ].join('');
}
