import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SEN_STATES } from './states';

test('sen-moments.yaml runs every motion lab state, in the order the gallery lists them', () => {
  const flow = readFileSync(join(__dirname, '../../../.maestro/sen-moments.yaml'), 'utf8');
  const run = [...flow.matchAll(/MOMENT: (\S+)/g)].map((m) => m[1]);
  expect(run).toEqual(Object.keys(SEN_STATES));
});
