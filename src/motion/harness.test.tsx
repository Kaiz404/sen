import { render, screen } from '@testing-library/react-native';
import { type ComponentClass, useEffect } from 'react';
import Animated, {
  Easing,
  getAnimatedStyle,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, type GProps, Rect } from 'react-native-svg';

// RNSVG's native G takes `matrix`, but its JS props type leaves it out.
const AnimatedG = Animated.createAnimatedComponent(
  G as unknown as ComponentClass<GProps & { matrix?: number[] }>,
);

function Slide() {
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withTiming(100, { duration: 1000, easing: Easing.linear }));
  }, [x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const props = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, x.get(), 0] }));
  return (
    <>
      <Animated.View testID="box" style={style} />
      <Svg viewBox="0 0 680 680">
        <AnimatedG testID="face" animatedProps={props}>
          <Rect width={10} height={10} />
        </AnimatedG>
      </Svg>
    </>
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a linear withTiming from 0 to 100 over 1000 ms is at 50 at its midpoint', async () => {
  await render(<Slide />);

  jest.advanceTimersByTime(500);

  expect(getAnimatedStyle(screen.getByTestId('box'))).toEqual({
    transform: [{ translateX: 50 }],
  });
  expect(screen.getByTestId('face')).toHaveAnimatedProps({ matrix: [1, 0, 0, 1, 50, 0] });
});

test('the SVG matrix lands on its end value', async () => {
  await render(<Slide />);

  jest.advanceTimersByTime(1000);

  expect(screen.getByTestId('face')).toHaveAnimatedProps({ matrix: [1, 0, 0, 1, 100, 0] });
});
