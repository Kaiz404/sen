import { render, screen } from '@testing-library/react-native';

import { FrozenMotion } from '@/motion/policy';

import { Bone, bandStyle } from './bone';

test('Full sweeps the band across the bone every 1.4 s, forever', () => {
  expect(bandStyle('full')).toEqual({
    animationName: {
      from: { transform: [{ translateX: '-100%' }] },
      to: { transform: [{ translateX: '100%' }] },
    },
    animationDuration: 1400,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  });
});

test.each(['calm', 'off'] as const)('%s draws a still bone', (level) => {
  expect(bandStyle(level)).toBeNull();
});

test('a frozen Bone draws no band, so a gallery shot has nothing to wait for', async () => {
  await render(<Bone width={40} height={10} />);
  expect(screen.toJSON()).toMatchObject({ children: [expect.anything()] });

  await screen.unmount();
  await render(
    <FrozenMotion>
      <Bone width={40} height={10} />
    </FrozenMotion>,
  );
  expect(screen.toJSON()).toMatchObject({ children: [] });
});
