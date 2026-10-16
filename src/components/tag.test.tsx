import { render, screen } from '@testing-library/react-native';

import { Tag } from './tag';

test.each([
  ['pending', 'PENDING'],
  ['added', 'ADDED BY YOU'],
  ['draft', 'DRAFT · NOT SAVED'],
] as const)('the %s tag reads "%s"', async (kind, text) => {
  await render(<Tag kind={kind} />);
  expect(screen.getByText(text)).toBeOnTheScreen();
});
