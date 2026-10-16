import { requireOptionalNativeModule } from 'expo';

import { copySensitive } from './clipboard';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const lookup = jest.mocked(requireOptionalNativeModule);

test('hands the text to the native sensitive copy', async () => {
  const setSensitiveStringAsync = jest.fn(async () => undefined);
  lookup.mockReturnValue({ setSensitiveStringAsync });

  expect(await copySensitive('FT26101400478213')).toBe(true);
  expect(lookup).toHaveBeenCalledWith('SenClipboard');
  expect(setSensitiveStringAsync).toHaveBeenCalledWith('FT26101400478213');
});

test('a build without the module reports a failed copy instead of throwing', async () => {
  lookup.mockReturnValue(null);
  expect(await copySensitive('FT26101400478213')).toBe(false);
});

test('a native error reports a failed copy', async () => {
  lookup.mockReturnValue({
    setSensitiveStringAsync: async () => Promise.reject(new Error('no clip')),
  });
  expect(await copySensitive('FT26101400478213')).toBe(false);
});
