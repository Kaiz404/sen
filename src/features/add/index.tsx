import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

export { AddLayout } from './add-layout';
export { AmountStep } from './amount-step';
export { DetailsStep } from './details-step';
export { ReviewStep } from './review-step';

export function DeleteSheet(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StubScreen name="DELETE" detail={id} />;
}
