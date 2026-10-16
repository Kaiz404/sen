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
  lockout: { priority: 3, then: 'lockoutBreathe' },
  lockoutBreathe: { priority: 3, loop: true },
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
const close: DirectorEvent = { type: 'gate', patch: { appActive: false } };
const open: DirectorEvent = { type: 'gate', patch: { appActive: true } };

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
    'a loop a closed gate cut short waits while another gate stays closed',
    [...two, req('a', 'lockPeek'), close, { type: 'gate', patch: { focused: false } }, open],
    [],
    null,
  ],
  [
    'a loop a closed gate cut short plays again once the last gate opens',
    [...two, req('a', 'lockPeek'), close, open],
    [{ type: 'play', sen: 'a', moment: 'lockPeek', token: 2 }],
    { sen: 'a', moment: 'lockPeek', token: 2 },
  ],
  [
    'a moment cut short before its follow-up loop comes back as that loop',
    [...two, req('a', 'lockout'), close, open],
    [{ type: 'play', sen: 'a', moment: 'lockoutBreathe', token: 2 }],
    { sen: 'a', moment: 'lockoutBreathe', token: 2 },
  ],
  [
    'a moment with no loop is not played again when the gate opens',
    [...two, req('a', 'glance'), close, open],
    [],
    null,
  ],
  [
    'a Sen that asks for another moment behind the gate lets go of its loop',
    [...two, req('a', 'lockPeek'), close, req('a', 'glance'), open],
    [],
    null,
  ],
  [
    'a stop behind the gate lets go of the loop',
    [...two, req('a', 'lockPeek'), close, { type: 'stop', sen: 'a' }, open],
    [],
    null,
  ],
  [
    'a stop settles the playing Sen and promotes the queued one',
    [...two, req('a', 'glance'), req('b', 'glance'), { type: 'stop', sen: 'a' }],
    [
      { type: 'settle', sen: 'a' },
      { type: 'play', sen: 'b', moment: 'glance', token: 2 },
    ],
    { sen: 'b', moment: 'glance', token: 2 },
  ],
  [
    'a stop for a Sen that plays nothing leaves the playing one alone',
    [...two, req('a', 'lockPeek'), { type: 'stop', sen: 'b' }],
    [],
    { sen: 'a', moment: 'lockPeek', token: 1 },
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

test('a stop for the queued Sen empties the slot, so nothing follows the playing moment', () => {
  const [s] = run([
    ...two,
    req('a', 'glance'),
    req('b', 'glance'),
    { type: 'stop', sen: 'b' },
  ]);
  expect(s.queued).toBeNull();

  const [, last] = run([
    ...two,
    req('a', 'glance'),
    req('b', 'glance'),
    { type: 'stop', sen: 'b' },
    { type: 'finished', token: 1 },
  ]);
  expect(last).toEqual([]);
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
