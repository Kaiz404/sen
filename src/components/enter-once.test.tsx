import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MotionPolicyRoot } from '@/motion/policy';

import { EnterOnce, enterStyle } from './enter-once';

test('Full slides in from 24 pt above over 900 ms', () => {
  expect(enterStyle('full')).toEqual({
    animationName: {
      from: { opacity: 0, transform: [{ translateY: -24 }] },
      to: { opacity: 1, transform: [{ translateY: 0 }] },
    },
    animationDuration: 900,
    animationTimingFunction: expect.anything(),
    animationFillMode: 'both',
  });
});

test.each(['calm', 'off'] as const)('%s shows the row in place with no animation', (level) => {
  expect(enterStyle(level)).toBeNull();
});

test('the wrapper renders its row', async () => {
  await render(
    <MotionPolicyRoot preference="off">
      <EnterOnce>
        <Text>Lunch with Hafiz, cash</Text>
      </EnterOnce>
    </MotionPolicyRoot>,
  );
  expect(screen.getByText('Lunch with Hafiz, cash')).toBeOnTheScreen();
});
