import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { getAnimatedStyle } from 'react-native-reanimated';

import { signedMinor } from '@/models/money';

import { BOARD_AMOUNTS } from './fixture-data';
import { digitStyle, type Revealed, RevealedAmounts, RollAmount } from './reveal';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const SHOWN: Revealed = { amounts: BOARD_AMOUNTS };

let commits = 0;
function Card({ value, size = 'hero' }: { value: Revealed | null; size?: 'hero' | 'row' }) {
  return (
    <Profiler id="card" onRender={() => commits++}>
      <RevealedAmounts value={value}>
        <RollAmount value={value === null ? null : signedMinor(-4250)} size={size} />
      </RevealedAmounts>
    </Profiler>
  );
}

const column = (i: number) => getAnimatedStyle(screen.getAllByTestId('digit-column')[i]!);

test('digit columns start in turn and land together', () => {
  expect(digitStyle(0, 0, 6)).toEqual({ opacity: 0, transform: [{ translateY: 10 }] });
  expect(digitStyle(0.35, 0, 6)).toEqual({ opacity: 0.5, transform: [{ translateY: 5 }] });
  expect(digitStyle(0.35, 5, 6).opacity).toBeCloseTo(0.0714, 4);
  expect(digitStyle(1, 5, 6)).toEqual({ opacity: 1, transform: [{ translateY: 0 }] });
  expect(digitStyle(0.5, 1, 30).opacity).toBeCloseTo(0.9655, 4);
});

test('the digits wait 200 ms, column 0 is mid-roll 100 ms into the roll, and the roll renders nothing', async () => {
  await render(<Card value={null} />);
  expect(screen.queryAllByTestId('digit-column')).toHaveLength(0);
  expect(screen.getByLabelText('Amount hidden')).toBeOnTheScreen();

  await screen.rerender(<Card value={SHOWN} />);
  const before = commits;
  expect(screen.getByLabelText('Minus 42 ringgit 50 sen')).toBeOnTheScreen();
  expect(screen.getAllByTestId('digit-column')).toHaveLength(6);

  await act(() => jest.advanceTimersByTime(100));
  expect(column(0).opacity).toBe(0);

  await act(() => jest.advanceTimersByTime(200));
  expect(column(0).opacity).toBeCloseTo(0.951, 2);
  expect(column(5).opacity).toBeCloseTo(0.522, 2);

  await act(() => jest.advanceTimersByTime(1000));
  expect(column(5)).toEqual({ opacity: 1, transform: [{ translateY: 0 }] });
  expect(commits).toBe(before);
});

test('a row amount rolls in whole on one animated view, and the roll renders nothing', async () => {
  await render(<Card value={null} size="row" />);
  await screen.rerender(<Card value={SHOWN} size="row" />);
  const before = commits;
  const roll = () => getAnimatedStyle(screen.getByTestId('amount-roll'));

  expect(screen.getByLabelText('Minus 42 ringgit 50 sen')).toBeOnTheScreen();
  expect(screen.queryAllByTestId('digit-column')).toHaveLength(0);
  expect(screen.getByText('42')).toBeOnTheScreen();

  await act(() => jest.advanceTimersByTime(300));
  expect(roll().opacity).toBeCloseTo(0.666, 2);

  await act(() => jest.advanceTimersByTime(1000));
  expect(roll()).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
  expect(commits).toBe(before);
});

test('hiding drops the digits at once', async () => {
  await render(<Card value={SHOWN} />);
  await act(() => jest.advanceTimersByTime(1000));

  await screen.rerender(<Card value={null} />);

  expect(screen.queryAllByTestId('digit-column')).toHaveLength(0);
  expect(screen.getByLabelText('Amount hidden')).toBeOnTheScreen();
});

const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

async function hero(content: number, box: number) {
  await render(
    <RevealedAmounts value={SHOWN}>
      <RollAmount value={signedMinor(-245210)} size="hero" />
    </RevealedAmounts>,
  );
  await fireEvent(screen.getByTestId('fit-box'), 'layout', layout(box, 120));
  await fireEvent(screen.getByTestId('fit-content'), 'layout', layout(content, 100));
}

test('a hero wider than the card scales down to fit, and its box shrinks with it', async () => {
  await hero(400, 300);
  expect(screen.getByLabelText('Minus 2452 ringgit 10 sen')).toBeOnTheScreen();
  expect(screen.getByTestId('fit-content')).toHaveStyle({ transform: [{ scale: 0.75 }] });
  expect(screen.getByTestId('fit-box')).toHaveStyle({ height: 75 });
});

test('a hero that fits keeps its size', async () => {
  await hero(280, 300);
  expect(screen.getByTestId('fit-content')).toHaveStyle({ transform: [{ scale: 1 }] });
  expect(screen.getByTestId('fit-box')).toHaveStyle({ height: 100 });
});

test('a tall hero scales to its maximum height, and its box takes that height', async () => {
  await render(
    <RevealedAmounts value={SHOWN}>
      <RollAmount value={signedMinor(-1230)} size="hero" fit={{ maxHeight: 96 }} />
    </RevealedAmounts>,
  );
  await fireEvent(screen.getByTestId('fit-box'), 'layout', layout(300, 120));
  await fireEvent(screen.getByTestId('fit-content'), 'layout', layout(200, 192));

  expect(screen.getByTestId('fit-content')).toHaveStyle({ transform: [{ scale: 0.5 }] });
  expect(screen.getByTestId('fit-box')).toHaveStyle({ height: 96 });
});

test('a hero stays unseen until it is measured, so a long amount never flashes unscaled', async () => {
  await render(
    <RevealedAmounts value={SHOWN}>
      <RollAmount value={signedMinor(-245210)} size="hero" />
    </RevealedAmounts>,
  );
  expect(screen.getByTestId('fit-content')).toHaveStyle({ opacity: 0 });

  await fireEvent(screen.getByTestId('fit-content'), 'layout', layout(280, 100));
  expect(screen.getByTestId('fit-content')).toHaveStyle({ opacity: 1 });
});
