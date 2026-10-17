import { requireOptionalNativeModule } from 'expo';

import { cancelDeviceCredential, confirmDeviceCredential } from './device-credential';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const lookup = jest.mocked(requireOptionalNativeModule);

test('hands the title to the native credential prompt and returns its answer', async () => {
  const confirmDeviceCredentialAsync = jest.fn(async () => ({ success: true }));
  lookup.mockReturnValue({ confirmDeviceCredentialAsync });

  expect(await confirmDeviceCredential('Unlock Sen')).toEqual({ success: true });
  expect(lookup).toHaveBeenCalledWith('SenAuth');
  expect(confirmDeviceCredentialAsync).toHaveBeenCalledWith('Unlock Sen');
});

test('a build without the module answers not available instead of throwing', async () => {
  lookup.mockReturnValue(null);
  expect(await confirmDeviceCredential('Unlock Sen')).toEqual({
    success: false,
    error: 'not_available',
  });
});

test('a native throw answers not available', async () => {
  lookup.mockReturnValue({ confirmDeviceCredentialAsync: async () => Promise.reject(new Error('x')) });
  expect(await confirmDeviceCredential('Unlock Sen')).toEqual({
    success: false,
    error: 'not_available',
  });
});

test('cancel reaches the module and survives a missing one', async () => {
  const cancelAsync = jest.fn(async () => undefined);
  lookup.mockReturnValue({ cancelAsync });
  await cancelDeviceCredential();
  expect(cancelAsync).toHaveBeenCalledTimes(1);

  lookup.mockReturnValue(null);
  await expect(cancelDeviceCredential()).resolves.toBeUndefined();
});
