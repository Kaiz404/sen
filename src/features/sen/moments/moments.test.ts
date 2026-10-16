import { drawing, firstFrame, lastFrame } from '../drawing';
import { poseFrame } from '../poses';
import { MOMENT_IDS, type MomentId } from '../timeline/types';
import { MOMENTS } from './index';

const endless = MOMENT_IDS.filter((id) => !MOMENTS[id].loop && !MOMENTS[id].then);

const follows = (id: MomentId) => MOMENT_IDS.find((other) => MOMENTS[other].then === id);
/** Empty search rises from behind the slip, so it opens 70 units down, which no pose draws. */
const HIDDEN_START: readonly MomentId[] = ['emptySearch'];

test.each(MOMENT_IDS.filter((id) => !follows(id) && !HIDDEN_START.includes(id)))(
  '%s opens on exactly what its start pose draws',
  (id) => {
    const m = MOMENTS[id];
    const from = poseFrame(m.from);
    expect(drawing(firstFrame(m, from))).toEqual(drawing(from));
  },
);

test.each(MOMENT_IDS.filter((id) => follows(id)))(
  '%s opens on exactly the frame the moment before it ends on',
  (id) => {
    const before = MOMENTS[follows(id)!];
    const end = lastFrame(before, poseFrame(before.from));
    expect(drawing(firstFrame(MOMENTS[id], end))).toEqual(drawing(end));
  },
);

test('Empty search opens with Sen 70 units down, hidden behind the slip, and rises by 420 ms', () => {
  expect(MOMENTS.emptySearch.tracks['mv.y']!.slice(0, 3)).toEqual([
    { at: 0, v: 70 },
    { at: 100, v: 70 },
    { at: 420, v: 0, ease: 'out' },
  ]);
});

test.each(endless)('%s ends on exactly what its end pose draws', (id) => {
  const m = MOMENTS[id];
  expect(drawing(lastFrame(m, poseFrame(m.from)))).toEqual(drawing(poseFrame(m.to)));
});

test.each(MOMENT_IDS)('%s keeps its steps in time order and inside its length', (id) => {
  const m = MOMENTS[id];
  for (const steps of Object.values(m.tracks)) {
    const ats = steps!.map((s) => s.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(Math.max(...ats)).toBeLessThanOrEqual(m.dur);
    steps!.slice(0, -1).forEach((s) => expect('spring' in s).toBe(false));
  }
  for (const mark of m.marks) expect(mark.at).toBeLessThanOrEqual(m.dur);
  if (m.loop) expect(m.marks).toEqual([]);
});

test('Unlock squints happily at 1370 ms with the open eyes the board squints, not the pose layer', () => {
  const end = lastFrame(MOMENTS.unlock, poseFrame('masked'));
  expect([end['elb.sx'], end['elb.sy'], end['el.sx'], end['el.sy']]).toEqual([1.15, 0.45, 1, 1]);
  expect([poseFrame('happy')['el.sx'], poseFrame('happy')['elb.sx']]).toEqual([1.15, 1]);
});

test.each(MOMENT_IDS.filter((id) => MOMENTS[id].loop))('%s ends each lap on the frame it opens on', (id) => {
  const m = MOMENTS[id];
  const start = firstFrame(m, poseFrame(m.from));
  expect(drawing(lastFrame(m, start))).toEqual(drawing(start));
});
