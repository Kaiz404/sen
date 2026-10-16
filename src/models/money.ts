import { z } from 'zod';

export const MinorSchema = z.number().int().nonnegative().brand<'Minor'>();
export type Minor = z.infer<typeof MinorSchema>;

export const SignedMinorSchema = z.number().int().brand<'SignedMinor'>();
export type SignedMinor = z.infer<typeof SignedMinorSchema>;

export type Direction = 'debit' | 'credit';

export function minor(sen: number): Minor {
  return MinorSchema.parse(sen);
}

export function signedMinor(sen: number): SignedMinor {
  return SignedMinorSchema.parse(sen);
}

export function signed(amount: Minor, type: Direction): SignedMinor {
  return signedMinor(type === 'debit' ? -amount : amount);
}

export const MINUS = '\u2212';
const THIN_SPACE = ' ';

export type SignMode = 'auto' | 'never';

/** The sign is added by hand because Hermes `Intl` lacks `signDisplay` on iOS. */
export type MoneyParts = {
  readonly sign: '' | '+' | typeof MINUS;
  readonly currency: 'RM';
  readonly whole: string;
  readonly fraction: string;
};

const grouped = new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 });

function split(value: SignedMinor): { ringgit: number; sen: number } {
  const magnitude = Math.abs(value);
  return { ringgit: Math.floor(magnitude / 100), sen: magnitude % 100 };
}

function signOf(value: SignedMinor, mode: SignMode): MoneyParts['sign'] {
  if (mode === 'never' || value === 0) return '';
  return value > 0 ? '+' : MINUS;
}

export function moneyParts(value: SignedMinor, sign: SignMode = 'auto'): MoneyParts {
  const { ringgit, sen } = split(value);
  return {
    sign: signOf(value, sign),
    currency: 'RM',
    whole: grouped.format(ringgit),
    fraction: `.${String(sen).padStart(2, '0')}`,
  };
}

export function moneyText(value: SignedMinor, sign: SignMode = 'auto'): string {
  const p = moneyParts(value, sign);
  return `${p.sign}${p.currency}${THIN_SPACE}${p.whole}${p.fraction}`;
}

export function moneySpoken(value: SignedMinor, sign: SignMode = 'auto'): string {
  const { ringgit, sen } = split(value);
  const words =
    ringgit === 0 && sen > 0
      ? `${sen} sen`
      : sen === 0
        ? `${ringgit} ringgit`
        : `${ringgit} ringgit ${sen} sen`;
  const s = signOf(value, sign);
  if (s === '') return words;
  return `${s === '+' ? 'Plus' : 'Minus'} ${words}`;
}
