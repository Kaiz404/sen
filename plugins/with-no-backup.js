// Plain CommonJS: Expo loads config plugins with Node's own resolver, which does not transpile TypeScript.
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const CLOUD_AND_DEVICE_DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];
const LEGACY_DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];

const exclusions = (domains, indent) =>
  domains.map((d) => `${indent}<exclude domain="${d}" path="." />`).join('\n');

/** Android 12+ (targetSdk 31+). Cloud backup and device-to-device transfer each need their own empty rules. */
const dataExtractionRulesXml = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${exclusions(CLOUD_AND_DEVICE_DOMAINS, '    ')}
  </cloud-backup>
  <device-transfer>
${exclusions(CLOUD_AND_DEVICE_DOMAINS, '    ')}
  </device-transfer>
</data-extraction-rules>
`;

/** Android 11 and lower. */
const fullBackupContentXml = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${exclusions(LEGACY_DOMAINS, '  ')}
</full-backup-content>
`;

const RULES_FILES = {
  dataExtractionRules: 'sen_data_extraction_rules',
  fullBackupContent: 'sen_backup_rules',
};

function pointAtRules(application) {
  application.$['android:dataExtractionRules'] = `@xml/${RULES_FILES.dataExtractionRules}`;
  application.$['android:fullBackupContent'] = `@xml/${RULES_FILES.fullBackupContent}`;
}

function writeRules(projectRoot) {
  const dir = join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${RULES_FILES.dataExtractionRules}.xml`), dataExtractionRulesXml);
  writeFileSync(join(dir, `${RULES_FILES.fullBackupContent}.xml`), fullBackupContentXml);
}

/**
 * Excludes everything from Auto Backup and from device-to-device transfer. `allowBackup: false` alone
 * does not stop device transfer on some Android 12+ devices.
 */
const withNoBackup = (config) => {
  config = withAndroidManifest(config, (c) => {
    pointAtRules(AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults));
    return c;
  });
  return withDangerousMod(config, [
    'android',
    (c) => {
      writeRules(c.modRequest.projectRoot);
      return c;
    },
  ]);
};

module.exports = withNoBackup;
module.exports.pointAtRules = pointAtRules;
module.exports.writeRules = writeRules;
