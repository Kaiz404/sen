import type { MomentId } from '../timeline/types';
import {
  type Command,
  direct,
  type DirectorEvent,
  type DirectorState,
  INITIAL,
  type MomentInfo,
} from './reducer';

/** Priorities chosen for the table, so the reducer is tested apart from the moment data. */
const INFO: Partial<Record<MomentId, ReturnType<MomentInfo>>> = {
  blink: { priority: 0 },
  glance: { priority: 1 },
  doubleBlink: { priority: 2, then: 'blink' },
  lockPeek: { priority: 2, loop: true },
  slowBlink: { priority: 3 },
};
const info: MomentInfo = (id) => INFO[id]!;

function run(events: readonly DirectorEvent[]): [DirectorState, Command[]] {
  let s = INITIAL;
  let last: Command[] = [];
  for (const e of events) [s, last] = direct(s, e, info);
  return [s, last];
}

const reg = (sen: string): DirectorEvent => ({ type: 'register', sen });
const req = (sen: string, moment: MomentId): DirectorEvent => ({ type: 'request', sen, moment });
const two = [reg('a'), reg('b')];

test.each<[string, readonly DirectorEvent[], Command[], DirectorState['playing']]>([
  [
    'an idle director plays a request',
    [...two, req('a', 'glance')],
    [{ type: 'play', sen: 'a', moment: 'glance', token: 1 }],
    { sen: 'a', moment: 'glance', token: 1 },
  ],
  ['an unregistered Sen is ignored', [req('a', 'glance')], [], null],
  [
    'a higher priority replaces the playing Sen, which settles',
    [...two, req('a', 'glance'), req('b', 'slowBlink')],
    [
      { type: 'settle', sen: 'a' },
      { type: 'play', sen: 'b', moment: 'slowBlink', token: 2 },
    ],
    { sen: 'b', moment: 'slowBlink', token: 2 },
  ],
  [
    'a lower priority from another Sen settles that Sen and leaves the moment playing',
    [...two, req('a', 'slowBlink'), req('b', 'glance')],
    [{ type: 'settle', sen: 'b' }],
    { sen: 'a', moment: 'slowBlink', token: 1 },
  ],
  [
    'a lower priority from the playing Sen is dropped, and its moment plays on to the end',
    [...two, req('a', 'slowBlink'), req('a', 'glance')],
    [],
    { sen: 'a', moment: 'slowBlink', token: 1 },
  ],
  [
    'P0 is dropped while anything plays',
    [...two, req('a', 'glance'), req('b', 'blink')],
    [],
    { sen: 'a', moment: 'glance', token: 1 },
  ],
  [
    'the playing Sen replaces its own moment at the same priority',
    [...two, req('a', 'glance'), req('a', 'glance')],
    [{ type: 'play', sen: 'a', moment: 'glance', token: 2 }],
    { sen: 'a', moment: 'glance', token: 2 },
  ],
  [
    'a loop yields to the same priority from another Sen',
    [...two, req('a', 'lockPeek'), req('b', 'doubleBlink')],
    [
      { type: 'settle', sen: 'a' },
      { type: 'play', sen: 'b', moment: 'doubleBlink', token: 2 },
    ],
    { sen: 'b', moment: 'doubleBlink', token: 2 },
  ],
  [
    'a finished moment hands over to its follow-up on the same Sen',
    [...two, req('a', 'doubleBlink'), { type: 'finished', token: 1 }],
    [{ type: 'play', sen: 'a', moment: 'blink', token: 2 }],
    { sen: 'a', moment: 'blink', token: 2 },
  ],
  [
    'a finish with a stale token is ignored',
    [...two, req('a', 'glance'), req('a', 'glance'), { type: 'finished', token: 1 }],
    [],
    { sen: 'a', moment: 'glance', token: 2 },
  ],
  [
    'a closed gate settles the playing Sen and plays nothing',
    [...two, req('a', 'glance'), { type: 'gate', patch: { scroll: true } }],
    [{ type: 'settle', sen: 'a' }],
    null,
  ],
  [
    'a request through a closed gate settles its Sen',
    [...two, { type: 'gate', patch: { focused: false } }, req('a', 'glance')],
    [{ type: 'settle', sen: 'a' }],
    null,
  ],
  [
    'P0 through a closed gate does nothing',
    [...two, { type: 'gate', patch: { appActive: false } }, req('a', 'blink')],
    [],
    null,
  ],
  [
    'unregistering the playing Sen promotes the queued one',
    [...two, req('a', 'glance'), req('b', 'glance'), { type: 'unregister', sen: 'a' }],
    [{ type: 'play', sen: 'b', moment: 'glance', token: 2 }],
    { sen: 'b', moment: 'glance', token: 2 },
  ],
])('%s', (_name, events, commands, playing) => {
  const [s, last] = run(events);
  expect(last).toEqual(commands);
  expect(s.playing).toEqual(playing);
});

test('the same priority from another Sen waits in one slot, and the newest takes it', () => {
  const [queued, none] = run([...two, reg('c'), req('a', 'glance'), req('b', 'glance')]);
  expect(none).toEqual([]);
  expect(queued.queued).toEqual({ sen: 'b', moment: 'glance' });

  const [bumped, settle] = run([
    ...two,
    reg('c'),
    req('a', 'glance'),
    req('b', 'glance'),
    req('c', 'glance'),
  ]);
  expect(settle).toEqual([{ type: 'settle', sen: 'b' }]);
  expect(bumped.queued).toEqual({ sen: 'c', moment: 'glance' });

  const [, next] = run([
    ...two,
    req('a', 'glance'),
    req('b', 'glance'),
    { type: 'finished', token: 1 },
  ]);
  expect(next).toEqual([{ type: 'play', sen: 'b', moment: 'glance', token: 2 }]);
});
