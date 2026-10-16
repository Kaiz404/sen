import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Leader, perforation, ReceiptSlip, SlipRule, zigzag } from './receipt-slip';

test('the perforated edge bites a semicircle every 14 pt', () => {
  expect(perforation(28)).toBe('M0,0 L3,0 A4,4 0 0 0 11,0 L17,0 A4,4 0 0 0 25,0 L28,0 V8 H0 Z');
});

test('the zigzag edge drops a tooth every 11 pt', () => {
  expect(zigzag(22)).toBe('M0,0 H22 L22,7.78 L16.5,2.28 L11,7.78 L5.5,2.28 L0,7.78 Z');
});

test('a slip lays its rows out between the edges', async () => {
  await render(
    <ReceiptSlip>
      <Text>Tealive</Text>
      <SlipRule />
      <Text>DAY NET</Text>
      <Leader />
    </ReceiptSlip>,
  );

  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(screen.getByText('DAY NET')).toBeOnTheScreen();
});
