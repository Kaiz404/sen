import { minor, moneyParts, moneySpoken, moneyText, signed, signedMinor } from './money';

describe('signed', () => {
  test('a debit becomes negative and a credit stays positive', () => {
    expect(signed(minor(4250), 'debit')).toBe(-4250);
    expect(signed(minor(4250), 'credit')).toBe(4250);
  });
});

describe('moneyParts', () => {
  test('splits a debit into a hand-made minus, grouped ringgit and two sen digits', () => {
    expect(moneyParts(signedMinor(-231740))).toEqual({
      sign: '−',
      currency: 'RM',
      whole: '2,317',
      fraction: '.40',
    });
  });

  test('gives a credit an explicit plus', () => {
    expect(moneyParts(signedMinor(4250))).toEqual({
      sign: '+',
      currency: 'RM',
      whole: '42',
      fraction: '.50',
    });
  });

  test('zero has no sign', () => {
    expect(moneyParts(signedMinor(0))).toEqual({
      sign: '',
      currency: 'RM',
      whole: '0',
      fraction: '.00',
    });
  });

  test('groups millions and pads single sen digits', () => {
    expect(moneyParts(signedMinor(123456705))).toEqual({
      sign: '+',
      currency: 'RM',
      whole: '1,234,567',
      fraction: '.05',
    });
  });

  test('never drops the sign for the keypad and the TOTAL line', () => {
    expect(moneyParts(signedMinor(-4250), 'never')).toEqual({
      sign: '',
      currency: 'RM',
      whole: '42',
      fraction: '.50',
    });
  });
});

describe('moneyText', () => {
  test('one string with U+2212 and a thin space after RM', () => {
    expect(moneyText(signedMinor(-4250))).toBe('−RM 42.50');
    expect(moneyText(signedMinor(450000))).toBe('+RM 4,500.00');
  });
});

describe('moneySpoken', () => {
  test.each([
    [-4250, 'Minus 42 ringgit 50 sen'],
    [35000, 'Plus 350 ringgit'],
    [-50, 'Minus 50 sen'],
    [0, '0 ringgit'],
    [-231740, 'Minus 2317 ringgit 40 sen'],
    [101, 'Plus 1 ringgit 1 sen'],
  ])('%i is read as "%s"', (sen, words) => {
    expect(moneySpoken(signedMinor(sen))).toBe(words);
  });

  test('never reads the magnitude only', () => {
    expect(moneySpoken(signedMinor(-4250), 'never')).toBe('42 ringgit 50 sen');
  });
});

describe('constructors', () => {
  test('a float or a negative magnitude is rejected', () => {
    expect(() => minor(42.5)).toThrow();
    expect(() => minor(-1)).toThrow();
    expect(() => signedMinor(-0.5)).toThrow();
    expect(signedMinor(-1)).toBe(-1);
  });
});
