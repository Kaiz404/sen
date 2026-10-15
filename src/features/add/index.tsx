import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { StubScreen } from '@/features/stub';

/**
 * The add flow's layout: a nested Stack, plus the draft reducer's provider once lane 4b adds it, so the
 * draft lives exactly as long as the flow and dies with it on lock.
 */
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

/** The delete confirm sheet over Detail. Step-up lives here, so delete stays with add in lane 4b. */
export function DeleteSheet(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StubScreen name="DELETE" detail={id} />;
}
