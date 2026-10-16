import { bandStyle } from './bone';

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
