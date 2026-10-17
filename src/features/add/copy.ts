import type { IconName } from '@/components/key';
import type { Biometric } from '@/features/auth';
import type { AddCategoryId } from '@/models/category';
import { addDays, type DayKey } from '@/models/day';

export const BIOMETRIC_NAME: Readonly<Record<Biometric, string>> = {
  faceId: 'Face ID',
  touchId: 'Touch ID',
  face: 'face unlock',
  fingerprint: 'fingerprint',
  biometrics: 'biometrics',
};

export const BIOMETRIC_ICON: Readonly<Record<Biometric, IconName>> = {
  faceId: 'face-recognition',
  touchId: 'fingerprint',
  face: 'face-recognition',
  fingerprint: 'fingerprint',
  biometrics: 'fingerprint',
};

export const CATEGORY_ICON: Readonly<Record<AddCategoryId, IconName>> = {
  food: 'food',
  transport: 'car',
  bills: 'lightning-bolt',
  shopping: 'shopping',
  groceries: 'cart',
  health: 'medical-bag',
  transfer: 'bank-transfer',
  other: 'dots-horizontal',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu 15 Oct", or "Thu 15 Oct 2026" with the year. */
export function dayText(day: DayKey, withYear = false): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const text = `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return withYear ? `${text} ${date.getUTCFullYear()}` : text;
}

/** "Today", "Yesterday" or "Thu 15 Oct". */
export function nearDayText(day: DayKey, today: DayKey): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return dayText(day);
}
