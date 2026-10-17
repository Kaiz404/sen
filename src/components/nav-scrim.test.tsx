import { render, screen } from '@testing-library/react-native';

import { light } from '@/theme/colors';
import { setInsets } from '@/theme/testing';

import { NavScrim } from './nav-scrim';

afterEach(() => setInsets({ bottom: 34 }));

test('the 3-button bar gets a canvas-coloured scrim as tall as the bar', async () => {
  setInsets({ bottom: 48 });
  await render(<NavScrim />);
  expect(screen.getByTestId('nav-scrim')).toHaveStyle({
    position: 'absolute',
    bottom: 0,
    height: 48,
    backgroundColor: light.canvas,
  });
});

test('the gesture bar gets none, and neither does a screen that opts out', async () => {
  await render(<NavScrim />);
  expect(screen.queryByTestId('nav-scrim')).toBeNull();

  setInsets({ bottom: 48 });
  await screen.rerender(<NavScrim hidden />);
  expect(screen.queryByTestId('nav-scrim')).toBeNull();
});
