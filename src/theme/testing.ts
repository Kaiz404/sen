import { UnistylesRuntime } from 'react-native-unistyles';

type Insets = typeof UnistylesRuntime.insets;

/** Tests only. Moves the test phone's insets, such as `ime` for a keyboard. Screens mounted after the call read them. */
export function setInsets(next: Partial<Insets>): void {
  Object.assign(UnistylesRuntime, { insets: { ...UnistylesRuntime.insets, ...next } });
}
