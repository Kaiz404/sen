import { fireEvent, render, screen } from '@testing-library/react-native';

import { DayKeySchema } from '@/models/day';

import { InlineDayPanel, localDateToDay, pickerRange } from './day-picker';

let mockChange: (event: unknown, date: Date) => void = () => {};
let mockProps: Record<string, unknown> = {};
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockProps = props;
    mockChange = props.onValueChange as typeof mockChange;
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));

const TODAY = DayKeySchema.parse('2026-10-15');

test('the iOS panel shows the inline calendar over the same 90-day range, and a pick closes it', async () => {
  const onDay = jest.fn();
  const onClose = jest.fn();
  await render(<InlineDayPanel day={TODAY} today={TODAY} onDay={onDay} onClose={onClose} />);

  expect(mockProps.display).toBe('inline');
  expect(mockProps.minimumDate).toEqual(pickerRange(TODAY).minimumDate);
  expect(mockProps.maximumDate).toEqual(pickerRange(TODAY).maximumDate);

  mockChange({}, new Date(2026, 9, 5, 9, 30));
  expect(onDay).toHaveBeenCalledWith('2026-10-05');
  mockChange({}, new Date(2026, 9, 16, 9, 30));
  expect(onDay).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Close date picker' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a local date becomes the day with the same year, month and day', () => {
  expect(localDateToDay(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03');
  expect(localDateToDay(new Date(NaN))).toBeNull();
});
