import { requireOptionalNativeModule } from 'expo';

type SenClipboard = { setSensitiveStringAsync(text: string): Promise<void> };

/**
 * Copies text marked sensitive (`modules/sen-clipboard`): Android 13+ masks it in the clipboard preview, and
 * iOS keeps it off other devices and clears it after two minutes. False when the copy didn't happen, including in
 * a build made before the module existed.
 */
export async function copySensitive(text: string): Promise<boolean> {
  const native = requireOptionalNativeModule<SenClipboard>('SenClipboard');
  if (native == null) return false;
  try {
    await native.setSensitiveStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
