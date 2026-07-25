import { z } from "zod";

import { parseAmountToMinor } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type ExpenseCategoryValue,
  type IncomeCategoryValue,
} from "@/types/treasury";

/**
 * Mirrors MAX_DESCRIPTION_LEN in the contract's storage.rs.
 *
 * The contract measures Soroban `String::len()`, which is BYTES, not
 * characters. Validating with `description.length` would let a 150-character
 * string containing emoji or accented characters pass here and then be
 * rejected on-chain -- after the user has already paid a fee and signed.
 */
export const MAX_DESCRIPTION_BYTES = 200;

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).length;

const descriptionSchema = z
  .string()
  .trim()
  .min(1, "Describe what this was for.")
  .refine(
    (value) => utf8Length(value) <= MAX_DESCRIPTION_BYTES,
    `Keep it under ${MAX_DESCRIPTION_BYTES} bytes — emoji and accented characters count for more than one.`,
  );

/**
 * Amount is validated as a STRING, never coerced to a number.
 *
 * `z.coerce.number()` would route the value through IEEE-754 and reintroduce
 * exactly the rounding error parseAmountToMinor exists to avoid.
 */
const amountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine(
    (value) => parseAmountToMinor(value) !== null,
    "Use digits with up to two decimal places, e.g. 1250.00",
  )
  .refine((value) => {
    const minor = parseAmountToMinor(value);
    return minor !== null && minor > 0n;
  }, "Amount must be greater than zero.");

const incomeValues = INCOME_CATEGORIES.map((category) => category.value) as [
  IncomeCategoryValue,
  ...IncomeCategoryValue[],
];

const expenseValues = EXPENSE_CATEGORIES.map((category) => category.value) as [
  ExpenseCategoryValue,
  ...ExpenseCategoryValue[],
];

export const incomeFormSchema = z.object({
  amount: amountSchema,
  category: z.enum(incomeValues, { message: "Choose a category." }),
  description: descriptionSchema,
});

export const expenseFormSchema = z.object({
  amount: amountSchema,
  category: z.enum(expenseValues, { message: "Choose a category." }),
  description: descriptionSchema,
});

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
