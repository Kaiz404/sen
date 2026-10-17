import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

type OpenOptions = Parameters<typeof DateTimePickerAndroid.open>[0];

export type PickerAnswer =
  | { readonly action: 'set'; readonly date: Date }
  | { readonly action: 'dismissed' }
  | { readonly action: 'error'; readonly error: Error };

export function lastOpenOptions(): OpenOptions {
  return jest.mocked(DateTimePickerAndroid.open).mock.lastCall![0];
}

/** Answers the last opened dialog through the same listeners the real `open` calls for each outcome. */
export function answerPicker(answer: PickerAnswer): void {
  const options = lastOpenOptions();
  if (answer.action === 'set') {
    options.onValueChange?.(
      { nativeEvent: { timestamp: answer.date.getTime(), utcOffset: 0 } },
      answer.date,
    );
  } else if (answer.action === 'dismissed') {
    options.onDismiss?.();
  } else {
    options.onError?.(answer.error);
  }
}
