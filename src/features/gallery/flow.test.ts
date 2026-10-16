import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { screenshotFlow, shots } from './flow';
import { SCREENS } from './registry';

const FLOW = join(__dirname, '../../../.maestro/screenshots.yaml');

test('a state becomes two shots and a pose one per tier', () => {
  const list = shots({ tag: { pending: () => null } });
  expect(list.slice(0, 2)).toEqual([
    { name: 'tag-pending-light', link: 'sen://dev/states?screen=tag&state=pending&theme=light' },
    { name: 'tag-pending-dark', link: 'sen://dev/states?screen=tag&state=pending&theme=dark' },
  ]);
  expect(list.slice(2, 5).map((s) => s.name)).toEqual([
    'pose-idle-32',
    'pose-idle-72',
    'pose-idle-200',
  ]);
  expect(list).toHaveLength(2 + 12 * 3);
});

test('.maestro/screenshots.yaml covers every registered state and pose', () => {
  const expected = screenshotFlow(shots(SCREENS));
  if (process.env.UPDATE_FLOW === '1') writeFileSync(FLOW, expected);
  expect(readFileSync(FLOW, 'utf8')).toBe(expected);
});
