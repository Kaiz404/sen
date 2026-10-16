import { act, render, screen, within } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { playMoment, senGate, senScroll } from '../director/store';
import { Sen, useSenAppGate } from '../index';

const hidden = { includeHiddenElements: true };
const prop = (sen: string, node: string, key: 'matrix' | 'opacity') =>
  within(screen.getByTestId(`sen-rig-${sen}`, hidden)).getByTestId(`sen-${node}`, hidden).props
    .jestAnimatedProps.value[key];
const faceX = (sen: string) => (prop(sen, 'lk', 'matrix') as number[])[4] ?? NaN;
const eyeOpen = (sen: string) => (prop(sen, 'elb', 'matrix') as number[])[3] ?? NaN;
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));
/** An ambient beat fires from a JS timer, and the rig starts it on the next UI frame. */
const FRAME = 16;

function TwoSens() {
  return (
    <>
      <Sen id="a" pose="idle" size={100} />
      <Sen id="b" pose="idle" size={100} />
    </>
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  senGate({ focused: true, appActive: true });
  jest.useRealTimers();
});

test('with two Sens on screen only one plays a moment, and the other stays still', async () => {
  await render(<TwoSens />);

  await act(() => {
    playMoment('a', 'glance');
    playMoment('b', 'glance');
  });
  await at(140);

  expect(faceX('a')).toBeCloseTo(-22, 1);
  expect(faceX('b')).toBe(0);
});

test('the glance follows .M-idle: blink with the turn, hold at -22, back by 1100 ms', async () => {
  await render(<TwoSens />);

  await act(() => playMoment('a', 'glance'));
  await at(60);
  expect(eyeOpen('a')).toBeCloseTo(0.1, 2);
  await at(640);
  expect(faceX('a')).toBe(-22);
  await at(400);
  expect(faceX('a')).toBe(0);
  expect(eyeOpen('a')).toBe(1);
});

test('a closed gate stops the moment and the Sen settles back into its pose', async () => {
  await render(<TwoSens />);

  await act(() => playMoment('a', 'glance'));
  await at(300);
  expect(faceX('a')).toBe(-22);
  await act(() => senGate({ appActive: false }));
  await at(500);

  expect(Math.abs(faceX('a'))).toBeLessThan(0.5);
});

test('nothing plays while the screen is out of focus', async () => {
  await render(<TwoSens />);

  await act(() => {
    senGate({ focused: false });
    playMoment('a', 'glance');
  });
  await at(300);
  expect(faceX('a')).toBe(0);

  await act(() => {
    senGate({ focused: true });
    playMoment('a', 'glance');
  });
  await at(300);
  expect(faceX('a')).toBe(-22);
});

test('a hero Sen resting idle blinks on its own after 4 to 7 s, and a 32 pt mark stays still', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(
    <>
      <Sen id="a" pose="idle" size={200} />
      <Sen id="b" pose="idle" size={32} />
    </>,
  );

  await at(3990);
  const a: number[] = [];
  const b: number[] = [];
  for (let t = 0; t < 300; t += 4) {
    await at(4);
    a.push(eyeOpen('a'));
    b.push(eyeOpen('b'));
  }

  expect(Math.min(...a)).toBeCloseTo(0.1, 1);
  expect(a[a.length - 1]).toBe(1);
  expect(new Set(b)).toEqual(new Set([1]));
  jest.restoreAllMocks();
});

test('the month card Sen resting revealed blinks over its grin and keeps its face up', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(<Sen id="a" pose="revealed" size={92} />);

  await at(3990);
  const eye: number[] = [];
  const grin: number[] = [];
  const faceY: number[] = [];
  for (let t = 0; t < 300; t += 4) {
    await at(4);
    eye.push(eyeOpen('a'));
    grin.push(prop('a', 'mo-grin', 'opacity') as number);
    faceY.push((prop('a', 'lk', 'matrix') as number[])[5]!);
  }

  expect(Math.min(...eye)).toBeCloseTo(0.1, 1);
  expect(eye[eye.length - 1]).toBe(1);
  expect(new Set(grin)).toEqual(new Set([1]));
  expect(new Set(faceY)).toEqual(new Set([-6]));
  jest.restoreAllMocks();
});

test('the masked Sen on Lock peeks toward Unlock every 6 to 9 s and closes its eye again', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(<Sen id="a" pose="masked" size={230} />);

  await at(6000 + FRAME + 240);
  expect(prop('a', 'lk', 'matrix')).toEqual([1, 0, 0, 1, 20, 26]);
  expect(prop('a', 'erb', 'opacity')).toBe(1);
  await at(1300);
  expect(prop('a', 'lk', 'matrix')).toEqual([1, 0, 0, 1, 0, 34]);
  expect(prop('a', 'erb', 'opacity')).toBe(0);
  jest.restoreAllMocks();
});

test('after three idle beats Sen rests 10 s, and a moment of its own starts the count again', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(<Sen id="a" pose="idle" size={200} />);
  const blinksBetween = async (from: number, to: number, now: number) => {
    await at(from - now);
    let closed = false;
    for (let t = from; t < to; t += 4) {
      await at(4);
      if (eyeOpen('a') < 0.5) closed = true;
    }
    return closed;
  };

  expect(await blinksBetween(7900, 8300, 0)).toBe(true);
  await act(() => playMoment('a', 'copy'));
  expect(await blinksBetween(15900, 16300, 8300)).toBe(true);
  expect(await blinksBetween(19900, 20300, 16300)).toBe(true);
  expect(await blinksBetween(23900, 24300, 20300)).toBe(false);
  jest.restoreAllMocks();
});

test('in the background nothing plays, and back in front Sen moves again', async () => {
  function Gated() {
    useSenAppGate();
    return <TwoSens />;
  }
  await render(<Gated />);
  const appGoes = (state: 'background' | 'inactive' | 'active') =>
    act(() => jest.mocked(AppState.addEventListener).mock.lastCall?.[1](state));

  await appGoes('background');
  await act(() => playMoment('a', 'glance'));
  await at(300);
  expect(faceX('a')).toBe(0);

  await appGoes('inactive');
  await act(() => playMoment('a', 'glance'));
  await at(300);
  expect(faceX('a')).toBe(-22);
});

test('a scroll the app leaves mid-fling no longer holds Sen once the app is back', async () => {
  function Gated() {
    useSenAppGate();
    return <TwoSens />;
  }
  await render(<Gated />);
  const appGoes = (state: 'background' | 'active') =>
    act(() => jest.mocked(AppState.addEventListener).mock.lastCall?.[1](state));

  await act(() => senScroll(true));
  await appGoes('background');
  await appGoes('active');
  await act(() => playMoment('a', 'glance'));
  await at(300);

  expect(faceX('a')).toBe(-22);
});
