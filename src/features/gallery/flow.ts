import { POSE_IDS } from '@/features/sen';

import { SEN_SIZES } from './poses';
import { shotName, type ThemeName } from './query';
import type { ScreenStates } from './registry';

export type Shot = { readonly name: string; readonly link: string };

const THEMES: readonly ThemeName[] = ['light', 'dark'];
const LINK = 'sen://dev/states';

/** Every screenshot the gallery owes: each state in both themes, then each pose at each tier. */
export function shots(screens: Readonly<Record<string, ScreenStates>>): Shot[] {
  const states = Object.entries(screens).flatMap(([screen, byState]) =>
    Object.keys(byState).flatMap((state) =>
      THEMES.map((theme) => ({
        name: shotName({ kind: 'state', screen, state }, theme)!,
        link: `${LINK}?screen=${screen}&state=${state}&theme=${theme}`,
      })),
    ),
  );
  const poses = POSE_IDS.flatMap((pose) =>
    SEN_SIZES.map((size) => ({
      name: shotName({ kind: 'pose', pose, size }, 'light')!,
      link: `${LINK}?screen=sen&pose=${pose}&size=${size}&theme=light`,
    })),
  );
  return [...states, ...poses];
}

/**
 * The Maestro flow that takes every shot as a candidate. The owner promotes approved candidates to
 * `assertScreenshot` baselines. Each step waits for the shot's test id, so a slow link never yields the last
 * screen. Animated states never settle, so the animation wait is capped.
 */
export function screenshotFlow(list: readonly Shot[]): string {
  const steps = list.map(
    (s) =>
      `- openLink: "${s.link}"\n` +
      `- extendedWaitUntil:\n    visible:\n      id: shot-${s.name}\n    timeout: 15000\n` +
      `- waitForAnimationToEnd:\n    timeout: 3000\n` +
      `- takeScreenshot: shots/2a/${s.name}\n`,
  );
  return [
    '# Generated from src/features/gallery by flow.test.ts. Run UPDATE_FLOW=1 npx jest gallery/flow to refresh.\n',
    'appId: com.kaiz404.sen\n',
    '---\n',
    '- launchApp:\n    clearState: false\n',
    '- openLink: sen://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081\n',
    '- extendedWaitUntil:\n    visible: UNLOCK\n    timeout: 60000\n',
    // A tap leaves Android's keyboard mode, which otherwise paints a focus highlight on the first key.
    '- tapOn:\n    point: 50%,92%\n',
    ...steps,
  ].join('');
}
