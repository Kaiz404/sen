import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/features/auth';
import { QK } from '@/services/query-client';
import { countManual } from '@/services/tx-repo';

/** How many rows the user added on this phone, or null while it loads or if it can't be read. */
export function useAddedCount(): number | null {
  const db = useDb();
  const { data } = useQuery({
    queryKey: [...QK.tx, 'added-count'],
    queryFn: () => countManual(db),
  });
  return data ?? null;
}
