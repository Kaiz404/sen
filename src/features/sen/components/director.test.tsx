import { act, render, screen, within } from '@testing-library/react-native';

import { playMoment, senGate } from '../director/store';
import { Sen } from '../index';

const hidden = { includeHiddenElements: true };
const prop = (sen: string, node: string, key: 'matrix' | 'opacity') =>
  within(screen.getByTestId(`sen-rig-${sen}`, hidden)).getByTestId(`sen-${node}`, hidden).props
    .jestAnimatedProps.value[key];
const faceX = (sen: string) => (prop(sen, 'lk', 'matrix') as number[])[4];
const eyeOpen = (sen: string) => (prop(sen, 'elb', 'matrix') as number[])[3];
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

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
  await at(1000);

  expect(faceX('a')).toBeCloseTo(0, 2);
});

test('nothing plays while the screen is out of focus', async () => {
  await render(<TwoSens />);

  await act(() => {
    senGate({ focused: false });
    playMoment('a', 'glance');
  });
  await at(300);

  expect(faceX('a')).toBe(0);
});

test('a hero Sen resting idle blinks on its own after 4 to 7 s, and a 32 pt mark stays still', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(
    <>
      <Sen id="a" pose="idle" size={200} />
      <Sen id="b" pose="idle" size={32} />
    </>,
  );

  await at(4060);

  expect(eyeOpen('a')).toBeCloseTo(0.1, 2);
  expect(eyeOpen('b')).toBe(1);
  jest.restoreAllMocks();
});

test('the masked Sen on Lock peeks toward Unlock every 6 to 9 s and closes its eye again', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await render(<Sen id="a" pose="masked" size={230} />);

  await at(6000 + 240);
  expect(prop('a', 'lk', 'matrix')).toEqual([1, 0, 0, 1, 20, 26]);
  expect(prop('a', 'erb', 'opacity')).toBe(1);
  await at(1300);
  expect(prop('a', 'lk', 'matrix')).toEqual([1, 0, 0, 1, 0, 34]);
  expect(prop('a', 'erb', 'opacity')).toBe(0);
  jest.restoreAllMocks();
});
