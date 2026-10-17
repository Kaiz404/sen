import { render, screen } from '@testing-library/react-native';

import { GalleryBody } from '@/features/gallery';
import { setInsets } from '@/theme/testing';

// jest.setup.ts gives every test a 48 pt status bar and a 34 pt gesture bar. The feature tests check their own
// surfaces. These render Add states from the gallery, as the phone shows them.
const STATUS_BAR = 48;
const GESTURE_BAR = 34;

const renderAdd = (state: string) =>
  render(<GalleryBody query={{ kind: 'state', screen: 'add', state }} />);

test('the discard dialog’s keys clear the gesture bar', async () => {
  await renderAdd('amount-discard');
  const dialog = screen.getByRole('header', { name: 'Discard this draft?' }).parent;
  expect(dialog?.parent).toHaveStyle({ paddingBottom: GESTURE_BAR + 16 });
});

describe('Add details, where the description field opens the keyboard', () => {
  test('the form starts below the status bar and Next sits above the gesture bar', async () => {
    await renderAdd('details-filled');
    expect(screen.getByTestId('add-details')).toHaveStyle({
      paddingTop: STATUS_BAR + 18,
      paddingBottom: GESTURE_BAR + 24,
    });
  });

  test('with the keyboard up, the form ends above the keyboard so Next and the date row stay reachable', async () => {
    setInsets({ ime: 300 });
    await renderAdd('details-filled');
    expect(screen.getByTestId('add-details')).toHaveStyle({ paddingBottom: GESTURE_BAR + 300 + 24 });
  });
});
