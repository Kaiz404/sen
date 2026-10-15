import { z } from 'zod';

/**
 * Integer sen, never negative. This is `Transaction.amountMinor`: a magnitude, with the direction kept in
 * `type`. Branded so a float, a ringgit number or a signed net can't stand in for it.
 */
export const MinorSchema = z.number().int().nonnegative().brand<'Minor'>();
export type Minor = z.infer<typeof MinorSchema>;

/**
 * Integer sen with a sign: credits positive, debits negative. Every formatter takes this. Day nets and month
 * totals come out of SQL already signed and parse straight into it.
 */
export const SignedMinorSchema = z.number().int().brand<'SignedMinor'>();
export type SignedMinor = z.infer<typeof SignedMinorSchema>;

export type Direction = 'debit' | 'credit';

/** For literals, fixtures and tests. Throws on a float or a negative. Services parse with MinorSchema. */
export function minor(sen: number): Minor {
  return MinorSchema.parse(sen);
}

/** For literals, fixtures and tests. Throws on a float. */
export function signedMinor(sen: number): SignedMinor {
  return SignedMinorSchema.parse(sen);
}

/** The one place a direction becomes a sign. */
export function signed(amount: Minor, type: Direction): SignedMinor {
  return signedMinor(type === 'debit' ? -amount : amount);
}

/** U+2212, not a hyphen. A hyphen sets short and breaks tabular alignment. */
export const MINUS = '−';
const THIN_SPACE = ' ';

/**
 * `auto`: `+` above zero, `−` below, nothing at zero. Rows, day nets, month totals, heroes.
 * `never`: magnitude only. The keypad readout and the facts table TOTAL, where a label carries direction.
 */
export type SignMode = 'auto' | 'never';

/**
 * A money value cut for split numerals: `RM 2,317` set large, `.40` set at under half size.
 * The sign is added by hand because Hermes `Intl` lacks `signDisplay` on iOS.
 */
export type MoneyParts = {
  readonly sign: '' | '+' | typeof MINUS;
  readonly currency: 'RM';
  /** Grouped ringgit, "2,317". "0" at zero. */
  readonly whole: string;
  /** A dot and two digits, ".40". */
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

/** -231740 gives { sign: '−', currency: 'RM', whole: '2,317', fraction: '.40' }. */
export function moneyParts(value: SignedMinor, sign: SignMode = 'auto'): MoneyParts {
  const { ringgit, sen } = split(value);
  return {
    sign: signOf(value, sign),
    currency: 'RM',
    whole: grouped.format(ringgit),
    fraction: `.${String(sen).padStart(2, '0')}`,
  };
}

/** One string for plain text (share receipt, toasts): "−RM 42.50", with a thin space after RM. */
export function moneyText(value: SignedMinor, sign: SignMode = 'auto'): string {
  const p = moneyParts(value, sign);
  return `${p.sign}${p.currency}${THIN_SPACE}${p.whole}${p.fraction}`;
}

/**
 * The accessibility label for a revealed amount. -4250 is "Minus 42 ringgit 50", 35000 is "Plus 350 ringgit",
 * -50 is "Minus 50 sen" and 0 is "0 ringgit". Digits stay ungrouped so no screen reader says "comma".
 */
export function moneySpoken(value: SignedMinor, sign: SignMode = 'auto'): string {
  const { ringgit, sen } = split(value);
  const words =
    ringgit === 0 && sen > 0
      ? `${sen} sen`
      : sen === 0
        ? `${ringgit} ringgit`
        : `${ringgit} ringgit ${sen}`;
  const s = signOf(value, sign);
  if (s === '') return words;
  return `${s === '+' ? 'Plus' : 'Minus'} ${words}`;
}
