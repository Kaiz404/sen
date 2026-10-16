import { pressKey } from './keypad-reducer';

test.each([
  [0, '0', 0],
  [0, '7', 7],
  [0, '00', 0],
  [0, 'back', 0],
  [4, '0', 40],
  [4, '7', 47],
  [4, '00', 400],
  [4, 'back', 0],
  [425, '0', 4250],
  [425, '7', 4257],
  [425, '00', 42500],
  [425, 'back', 42],
  [123456, '0', 1234560],
  [123456, '7', 1234567],
  [123456, '00', 123456],
  [123456, 'back', 12345],
  [1234567, '0', 1234567],
  [1234567, '7', 1234567],
  [1234567, '00', 1234567],
  [1234567, 'back', 123456],
] as const)('%i sen, then %s, is %i sen', (sen, key, expected) => {
  expect(pressKey(sen, key)).toBe(expected);
});

test('typing 4 2 5 0 reads RM 42.50', () => {
  const keys = ['4', '2', '5', '0'] as const;
  expect(keys.reduce(pressKey, 0)).toBe(4250);
});
