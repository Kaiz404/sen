import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

export function AddLayout(): ReactNode {
  return <Stack screenOptions={{ headerShown: false }} />;
}

export function AmountStep(): ReactNode {
  return <StubScreen name="ADD AMOUNT" />;
}

export function DetailsStep(): ReactNode {
  return <StubScreen name="ADD DETAILS" />;
}

export function ReviewStep(): ReactNode {
  return <StubScreen name="ADD REVIEW" />;
}

export function DeleteSheet(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StubScreen name="DELETE" detail={id} />;
}
