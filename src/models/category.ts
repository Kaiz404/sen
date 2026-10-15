import { z } from 'zod';

export const CATEGORIES = [
  'food',
  'groceries',
  'transport',
  'bills',
  'shopping',
  'health',
  'transfer',
  'topup',
  'income',
  'other',
] as const;

export const CategorySchema = z.enum(CATEGORIES);
export type CategoryId = z.infer<typeof CategorySchema>;

export const ADD_CATEGORIES = [
  'food',
  'transport',
  'bills',
  'shopping',
  'groceries',
  'health',
  'transfer',
  'other',
] as const satisfies readonly CategoryId[];

export type AddCategoryId = (typeof ADD_CATEGORIES)[number];

export const CATEGORY_LABEL: Readonly<Record<CategoryId, string>> = {
  food: 'Food & drink',
  groceries: 'Groceries',
  transport: 'Transport',
  bills: 'Bills & utilities',
  shopping: 'Shopping',
  health: 'Health',
  transfer: 'Transfer',
  topup: 'Top up',
  income: 'Salary',
  other: 'Other',
};
