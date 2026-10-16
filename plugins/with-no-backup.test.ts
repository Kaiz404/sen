import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pointAtRules, writeRules } from './with-no-backup';

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];
const domainsIn = (xml: string) => [...xml.matchAll(/domain="(\w+)"/g)].map((m) => m[1]);

test('the manifest points at both rule files and keeps allowBackup', () => {
  const application = { $: { 'android:allowBackup': 'false' } as Record<string, string> };

  pointAtRules(application);

  expect(application.$).toEqual({
    'android:allowBackup': 'false',
    'android:dataExtractionRules': '@xml/sen_data_extraction_rules',
    'android:fullBackupContent': '@xml/sen_backup_rules',
  });
});

describe('the written rules', () => {
  const root = mkdtempSync(join(tmpdir(), 'sen-backup-'));
  afterAll(() => rmSync(root, { recursive: true }));
  const read = (name: string) =>
    readFileSync(join(root, 'android/app/src/main/res/xml', `${name}.xml`), 'utf8');

  beforeAll(() => writeRules(root));

  test('Android 12 rules exclude every domain from cloud backup and device transfer', () => {
    const xml = read('sen_data_extraction_rules');
    const [cloud = '', transfer = ''] = xml.split('<device-transfer>');

    expect(domainsIn(cloud).sort()).toEqual(
      [...DOMAINS, 'device_root', 'device_file', 'device_database', 'device_sharedpref'].sort(),
    );
    expect(domainsIn(transfer).sort()).toEqual(domainsIn(cloud).sort());
    expect(xml).not.toContain('<include');
  });

  test('Android 11 rules exclude every domain', () => {
    expect(domainsIn(read('sen_backup_rules'))).toEqual(DOMAINS);
  });
});
