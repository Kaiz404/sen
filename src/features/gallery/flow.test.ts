import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { screenshotFlow, shots } from './flow';
import { SCREENS } from './registry';

const FLOW = join(__dirname, '../../../.maestro/screenshots.yaml');

test('shots run light states, then poses, then dark states, so the theme switches once', () => {
  const list = shots({ tag: { pending: () => null } });
  expect(list.map((s) => s.name).slice(0, 4)).toEqual([
    'tag-pending-light',
    'pose-idle-32',
    'pose-idle-72',
    'pose-idle-200',
  ]);
  expect(list.at(-1)).toEqual({
    name: 'tag-pending-dark',
    link: 'sen://dev/states?screen=tag&state=pending&theme=dark',
  });
  expect(list).toHaveLength(2 + 12 * 3);
});

test('.maestro/screenshots.yaml covers every registered state and pose', () => {
  const expected = screenshotFlow(shots(SCREENS));
  if (process.env.UPDATE_FLOW === '1') writeFileSync(FLOW, expected);
  expect(readFileSync(FLOW, 'utf8')).toBe(expected);
});
