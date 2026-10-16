import { POSE_IDS } from '@/features/sen';

import { SEN_SIZES } from './poses';
import { shotName, type ThemeName } from './query';
import type { ScreenStates } from './registry';

export type Shot = { readonly name: string; readonly link: string };

const LINK = 'sen://dev/states';

/** Every screenshot the gallery owes, grouped by theme so the slow theme switch happens once: light states, poses, dark states. */
export function shots(screens: Readonly<Record<string, ScreenStates>>): Shot[] {
  const states = (theme: ThemeName) =>
    Object.entries(screens).flatMap(([screen, byState]) =>
      Object.keys(byState).map((state) => ({
        name: shotName({ kind: 'state', screen, state }, theme)!,
        link: `${LINK}?screen=${screen}&state=${state}&theme=${theme}`,
      })),
    );
  const poses = POSE_IDS.flatMap((pose) =>
    SEN_SIZES.map((size) => ({
      name: shotName({ kind: 'pose', pose, size }, 'light')!,
      link: `${LINK}?screen=sen&pose=${pose}&size=${size}&theme=light`,
    })),
  );
  return [...states('light'), ...poses, ...states('dark')];
}

export function screenshotFlow(list: readonly Shot[]): string {
  const steps = list.map(
    (s, i) =>
      `- openLink: "${s.link}"\n` +
      `- extendedWaitUntil:\n    visible:\n      id: shot-${s.name}\n    timeout: ${i === 0 ? 120000 : 15000}\n` +
      `- waitForAnimationToEnd:\n    timeout: 3000\n` +
      `- takeScreenshot: shots/2a/${s.name}\n`,
  );
  return [
    '# Generated from src/features/gallery by flow.test.ts. Run UPDATE_FLOW=1 npx jest gallery/flow to refresh.\n',
    'appId: com.kaiz404.sen\n',
    '---\n',
    // The gallery opens while locked, so the flow reuses the running app instead of a slow cold start.
    '- launchApp:\n    stopApp: false\n',
    // A tap leaves Android's keyboard mode, which otherwise paints a focus highlight on the first key.
    '- tapOn:\n    point: 50%,40%\n',
    ...steps,
  ].join('');
}
