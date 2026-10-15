import { getRandomValues } from 'expo-crypto';
import { type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { DbKeySchema, deleteDb, openDb } from '@/services/db';
import { type } from '@/theme/type';

const SMOKE_DB = 'sen-smoke.db';

type Smoke =
  | { readonly state: 'running' }
  | {
      readonly state: 'done';
      readonly cipher: string;
      readonly version: string;
      readonly day: string;
    }
  | { readonly state: 'failed'; readonly reason: string };

async function runSmoke(): Promise<Smoke> {
  const hex = Array.from(getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  );
  const key = DbKeySchema.parse(hex.join(''));
  await deleteDb(SMOKE_DB).catch(() => undefined);
  const db = await openDb(key, SMOKE_DB);
  try {
    const [cipher] = await db.all('PRAGMA cipher_version');
    const [version] = await db.all('PRAGMA user_version');
    await db.run(
      `INSERT INTO tx (id, amount_minor, currency, type, description, merchant, category, status,
        posted_at, reference, account_name, account_last4, source, idem_key, search_text)
        VALUES ('smoke', 1, 'MYR', 'debit', 'Smoke', 'Smoke', 'other', 'posted',
        '2026-10-15T16:30:00.000Z', 'SMOKE', 'Smoke', '0000', 'bank', NULL, 'smoke')`,
    );
    const [row] = await db.all("SELECT day FROM tx WHERE id = 'smoke'");
    return {
      state: 'done',
      cipher: String(cipher?.cipher_version ?? 'none'),
      version: String(version?.user_version ?? 'none'),
      day: String(row?.day ?? 'none'),
    };
  } finally {
    await db.close();
    await deleteDb(SMOKE_DB);
  }
}

export function DbSmoke(): ReactNode {
  const [smoke, setSmoke] = useState<Smoke>({ state: 'running' });

  useEffect(() => {
    let live = true;
    runSmoke().then(
      (result) => live && setSmoke(result),
      (error: unknown) =>
        live &&
        setSmoke({ state: 'failed', reason: error instanceof Error ? error.message : 'unknown' }),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>DB SMOKE</Text>
      <Text testID="smoke-state" style={styles.line}>{`state ${smoke.state}`}</Text>
      {smoke.state === 'done' && (
        <>
          <Text testID="smoke-cipher" style={styles.line}>{`cipher_version ${smoke.cipher}`}</Text>
          <Text testID="smoke-version" style={styles.line}>{`user_version ${smoke.version}`}</Text>
          <Text testID="smoke-day" style={styles.line}>{`day ${smoke.day}`}</Text>
        </>
      )}
      {smoke.state === 'failed' && (
        <Text testID="smoke-reason" style={styles.line}>
          {smoke.reason}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    backgroundColor: theme.colors.canvas,
  },
  title: { ...type.words(40), color: theme.colors.ink },
  line: { ...type.mono(15), color: theme.colors.ink },
}));
