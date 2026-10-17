import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { addDays, type DayKey, DayKeySchema } from '@/models/day';
import { DRAFT_LIMITS, isInAddWindow } from '@/models/draft';
import { type } from '@/theme/type';

import { todayInMalaysia } from './add-layout';

/**
 * The native pickers speak in `Date`s on the device's clock, and a `DayKey` is a Malaysia day. The picker only
 * ever shows calendar days, so a day crosses the boundary as the same year, month and day on the local clock.
 * Noon keeps the value away from any midnight shift.
 */
export function dayToLocalDate(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function localDateToDay(date: Date): DayKey | null {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const parsed = DayKeySchema.safeParse(
    `${String(date.getFullYear()).padStart(4, '0')}-${mm}-${dd}`,
  );
  return parsed.success ? parsed.data : null;
}

/** The calendar greys out every day the add window refuses: the first of the last 90 days through today. */
export function pickerRange(today: DayKey): { minimumDate: Date; maximumDate: Date } {
  const first = dayToLocalDate(addDays(today, -DRAFT_LIMITS.daysBack));
  first.setHours(0, 0, 0, 0);
  const last = dayToLocalDate(today);
  last.setHours(23, 59, 59, 999);
  return { minimumDate: first, maximumDate: last };
}

/**
 * Gives a chosen date to the draft only when the add window allows it. Today is read now, not when the picker
 * opened, so a dialog left open past midnight still refuses tomorrow.
 */
function acceptDate(date: Date, onDay: (day: DayKey) => void): void {
  const day = localDateToDay(date);
  if (day !== null && isInAddWindow(day, todayInMalaysia())) onDay(day);
}

type DayPickerArgs = {
  readonly day: DayKey;
  readonly today: DayKey;
  readonly onDay: (day: DayKey) => void;
};

/**
 * Android opens the system calendar dialog, which sits above the app and needs no markup. iOS has no dialog, so
 * `panel` holds the inline calendar in the sheet this screen already used, and `open` shows it.
 */
export function useDayPicker({ day, today, onDay }: DayPickerArgs): {
  readonly open: () => void;
  readonly panel: ReactNode;
} {
  const [shown, setShown] = useState(false);
  const isOpen = useRef(false);
  useEffect(
    () => () => {
      if (isOpen.current) DateTimePickerAndroid.dismiss('date').catch(() => {});
    },
    [],
  );
  if (Platform.OS !== 'ios') {
    const close = () => {
      isOpen.current = false;
    };
    return {
      open: () => {
        if (isOpen.current) return;
        isOpen.current = true;
        DateTimePickerAndroid.open({
          mode: 'date',
          value: dayToLocalDate(day),
          ...pickerRange(today),
          onValueChange: (_event, date) => {
            close();
            acceptDate(date, onDay);
          },
          onDismiss: close,
          onError: close,
        });
      },
      panel: null,
    };
  }
  return {
    open: () => setShown(true),
    panel: shown ? (
      <InlineDayPanel
        day={day}
        today={today}
        onDay={(next) => {
          onDay(next);
          setShown(false);
        }}
        onClose={() => setShown(false)}
      />
    ) : null,
  };
}

export function InlineDayPanel({
  day,
  today,
  onDay,
  onClose,
}: DayPickerArgs & { readonly onClose: () => void }): ReactNode {
  const { theme, rt } = useUnistyles();
  return (
    <View style={styles.scrim}>
      <View style={styles.backdrop} />
      <View accessibilityViewIsModal style={styles.panel}>
        <View style={styles.top}>
          <Text accessibilityRole="header" style={styles.title}>
            Pick a date
          </Text>
          <Key icon="close" accessibilityLabel="Close date picker" onPress={onClose} />
        </View>
        <DateTimePicker
          mode="date"
          display="inline"
          value={dayToLocalDate(day)}
          {...pickerRange(today)}
          accentColor={theme.colors.loud}
          themeVariant={rt.themeName === 'dark' ? 'dark' : 'light'}
          onValueChange={(_event, date) => acceptDate(date, onDay)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.hero, opacity: 0.5 },
  panel: { gap: 12, padding: 20, borderRadius: 24, backgroundColor: theme.colors.canvas },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...type.words(28), color: theme.colors.ink },
}));
