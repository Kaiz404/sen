import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { type MotionLevel, MotionPolicyRoot, resolveMotion, useMotionPolicy } from './policy';

test.each([
  ['full', false, 'full'],
  ['full', true, 'calm'],
  ['calm', false, 'calm'],
  ['calm', true, 'calm'],
  ['off', false, 'off'],
  ['off', true, 'off'],
] as [MotionLevel, boolean, MotionLevel][])(
  'preference %s with system reduce %s resolves to %s',
  (preference, systemReduce, level) => {
    expect(resolveMotion(preference, systemReduce)).toBe(level);
  },
);

function Probe() {
  return <Text>{`level:${useMotionPolicy()}`}</Text>;
}

test('without a root the level is full, so component tests need no wrapper', async () => {
  await render(<Probe />);
  expect(screen.getByText('level:full')).toBeOnTheScreen();
});

test('the root follows the live system setting', async () => {
  let notify: (on: boolean) => void = () => {};
  const listen = (_: string, handler: (on: boolean) => void) => {
    notify = handler;
    return { remove: () => {} };
  };
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(listen as unknown as typeof AccessibilityInfo.addEventListener);

  await render(
    <MotionPolicyRoot preference="full">
      <Probe />
    </MotionPolicyRoot>,
  );
  expect(screen.getByText('level:calm')).toBeOnTheScreen();

  await act(async () => notify(false));
  expect(screen.getByText('level:full')).toBeOnTheScreen();
});
