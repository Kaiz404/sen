import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { SheetSurface } from './sheet-surface';

async function renderOn(os: 'android' | 'ios') {
  const original = Platform.OS;
  Platform.OS = os;
  try {
    await render(
      <SheetSurface>
        <Text>Keep it</Text>
      </SheetSurface>,
    );
  } finally {
    Platform.OS = original;
  }
}

describe('SheetSurface', () => {
  it('draws a handle on Android that a screen reader skips', async () => {
    await renderOn('android');
    expect(screen.getByText('Keep it')).toBeOnTheScreen();
    expect(screen.getByTestId('sheet-handle', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('sheet-handle')).toBeNull();
  });

  it('leaves the grabber to iOS', async () => {
    await renderOn('ios');
    expect(screen.getByText('Keep it')).toBeOnTheScreen();
    expect(screen.queryByTestId('sheet-handle', { includeHiddenElements: true })).toBeNull();
  });

  it('keeps its last key 20 above the gesture bar', async () => {
    await renderOn('android');
    expect(screen.root).toHaveStyle({ paddingBottom: 34 + 20 });
  });
});
