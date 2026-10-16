import { drawing, firstFrame, lastFrame } from '../drawing';
import { poseFrame } from '../poses';
import { MOMENT_IDS } from '../timeline/types';
import { MOMENTS } from './index';

const endless = MOMENT_IDS.filter((id) => !MOMENTS[id].loop && !MOMENTS[id].then);

test.each(MOMENT_IDS)('%s opens on exactly what its start pose draws', (id) => {
  const m = MOMENTS[id];
  const from = poseFrame(m.from);
  expect(drawing(firstFrame(m, from))).toEqual(drawing(from));
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
