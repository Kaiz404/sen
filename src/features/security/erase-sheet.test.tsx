import { render, screen } from '@testing-library/react-native';

import { BIOMETRIC } from '@/features/auth';

import { EraseView } from './erase-sheet';

test('an erase whose check timed out says nothing was erased and offers another try', async () => {
  await render(
    <EraseView
      sensor={BIOMETRIC.fingerprint}
      phase={{ kind: 'refused', reason: 'timedOut' }}
      count={2}
      onErase={jest.fn()}
      onCancel={jest.fn()}
      onOpenSettings={jest.fn()}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'The check timed out. Nothing was erased. Try again when you’re ready.',
  );
  expect(screen.getByRole('button', { name: 'Try again with fingerprint' })).toBeEnabled();
});
