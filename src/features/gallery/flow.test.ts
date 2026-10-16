import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { flowYaml, shotFlows } from './flow';
import { SCREENS } from './registry';

const DIR = join(__dirname, '../../../.maestro/gallery');

test('each screen gets a light and a dark flow, and each pose one flow across its sizes', () => {
  const flows = shotFlows({ tag: { pending: () => null, added: () => null } });
  expect(flows.map((f) => f.name).slice(0, 3)).toEqual(['tag-light', 'tag-dark', 'pose-idle']);
  expect(flows[1]!.shots).toEqual([
    { name: 'tag-pending-dark', link: 'sen://dev/states?screen=tag&state=pending&theme=dark' },
    { name: 'tag-added-dark', link: 'sen://dev/states?screen=tag&state=added&theme=dark' },
  ]);
  expect(flows[2]!.shots.map((s) => s.name)).toEqual([
    'pose-idle-32',
    'pose-idle-72',
    'pose-idle-200',
  ]);
  expect(flows).toHaveLength(2 + 12);
});

test('a flow opens each link, waits for its shot id to settle, then saves the shot under its name', () => {
  const yaml = flowYaml({
    name: 'tag-dark',
    shots: [
      { name: 'tag-pending-dark', link: 'sen://dev/states?screen=tag&state=pending&theme=dark' },
      { name: 'tag-added-dark', link: 'sen://dev/states?screen=tag&state=added&theme=dark' },
    ],
  });
  expect(yaml.split('\n').slice(1)).toEqual([
    'appId: com.kaiz404.sen',
    '---',
    '- openLink: "sen://dev/states?screen=tag&state=pending&theme=dark"',
    '- extendedWaitUntil:',
    '    visible:',
    '      id: shot-tag-pending-dark',
    '    timeout: 120000',
    '- waitForAnimationToEnd:',
    '    timeout: 3000',
    '- takeScreenshot: tag-pending-dark',
    '- openLink: "sen://dev/states?screen=tag&state=added&theme=dark"',
    '- extendedWaitUntil:',
    '    visible:',
    '      id: shot-tag-added-dark',
    '    timeout: 15000',
    '- waitForAnimationToEnd:',
    '    timeout: 3000',
    '- takeScreenshot: tag-added-dark',
    '',
  ]);
});

test('.maestro/gallery holds exactly one flow per registered screen, theme and pose', () => {
  const expected = new Map(shotFlows(SCREENS).map((f) => [`${f.name}.yaml`, flowYaml(f)]));
  if (process.env.UPDATE_FLOW === '1') {
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(DIR);
    for (const [file, yaml] of expected) writeFileSync(join(DIR, file), yaml);
  }
  const actual = new Map(readdirSync(DIR).map((f) => [f, readFileSync(join(DIR, f), 'utf8')]));
  expect(actual).toEqual(expected);
});
