import { act, render, screen } from '@testing-library/react-native';

import { dark } from '@/theme/colors';
import { applyTheme } from '@/theme/unistyles';

import { Stamp } from './stamp';

test('a labelled stamp is one image for screen readers', async () => {
  await render(
    <Stamp
      caption="ADDED BY"
      word="You"
      date="15·10·26"
      accessibilityLabel="Stamp: added by you"
    />,
  );
  expect(screen.getByRole('image', { name: 'Stamp: added by you' })).toHaveTextContent(
    'ADDED BYYou15·10·26',
  );
});

test('an unlabelled stamp is decoration and hidden from screen readers', async () => {
  await render(<Stamp caption="BELUM SELESAI" word="Pending" date="14·10·26" />);
  expect(screen.queryByRole('image')).toBeNull();
  expect(screen.queryByText('Pending')).toBeNull();
  expect(screen.getByText('Pending', { includeHiddenElements: true })).toBeOnTheScreen();
});

test('the stamp ink follows a live switch to Dark', async () => {
  await render(<Stamp caption="ADDED BY" word="You" date="15·10·26" accessibilityLabel="Stamp" />);

  await act(() => applyTheme('dark'));

  expect(screen.getByText('You')).toHaveStyle({ color: dark.stamp });
  expect(screen.getByText('15·10·26')).toHaveStyle({ color: dark.stamp });
});
