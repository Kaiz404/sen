import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { boardTracks, slice } from './board';
import { BOARDS } from './board.gen';

const ROOT = join(__dirname, '../../..');

test('board.gen.ts is what the script prints from the boards in design/', () => {
  const printed = execFileSync(
    'python3',
    [
      '-I',
      'scripts/board-keyframes.py',
      '--ts',
      'design/MAX-Library.dc.html',
      'design/MAX-Moments.dc.html',
      'design/MAL2-Loading.dc.html',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  expect(printed).toBe(readFileSync(join(__dirname, 'board.gen.ts'), 'utf8'));
});

test("Unlock's face presses to 46, pops to -14 and settles at -6, as on MAX-Moments", () => {
  expect(BOARDS['MAX-Moments']['.M-unlock']['lk.y']).toEqual([
    [0, 34],
    [80, 46, 'outQ'],
    [260, -14, 'out'],
    [380, -6, 'sine'],
    [2800, -6],
    [3002, 34, 'sine'],
    [3400, 34],
  ]);
});

test("the board's scaleX flip becomes one forward turn of the spin angle, linear by quarters", () => {
  expect(BOARDS['MAX-Moments']['.M-unlock']['sp.th']).toEqual([
    [0, 0],
    [520, 0],
    [670, 1.550795],
    [820, 3.141593],
    [970, 4.692388],
    [1120, 6.283185],
    [3400, 6.283185],
  ]);
});

test('turning back from edge-on spins the angle backwards, so the coin never shows tails', () => {
  expect(BOARDS['MAX-Moments']['.M-lockout']['sp.th']).toEqual([
    [0, 0],
    [700, 0],
    [1300, 1.530786, 'sine'],
    [6000, 1.530786],
    [6600, 0],
    [7000, 0],
  ]);
});

test('a slice rebases its window to 0 and holds the value from before it', () => {
  const steps = [
    [0, 0],
    [400, 10, 'out'],
    [800, 10],
    [1000, 0, 'sine'],
  ] as const;

  expect(slice(steps, { from: 600, to: 1000 })).toEqual([
    { at: 0, v: 10 },
    { at: 200, v: 10 },
    { at: 400, v: 0, ease: 'sine' },
  ]);
});

test('board tracks keep every rig channel, and a value that never changes becomes one step at 0', () => {
  const reveal = boardTracks(BOARDS['MAX-Moments']['.M-reveal'], { to: 760 });
  const fail = boardTracks(BOARDS['MAX-Moments']['.M-face.ph-fail'], { to: 1850 });

  expect(reveal['mv.x']).toEqual([{ at: 0, v: 0 }]);
  expect(reveal['mv.y']).toEqual([
    { at: 0, v: 0 },
    { at: 160, v: 0 },
    { at: 280, v: -22, ease: 'outQ' },
    { at: 380, v: 0, ease: 'inQ' },
  ]);
  expect(fail['elb.sx']).toEqual([{ at: 0, v: 0.9 }]);
  expect('dots.op' in reveal).toBe(false);
});
