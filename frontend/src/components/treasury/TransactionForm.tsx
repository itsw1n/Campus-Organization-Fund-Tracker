"use client";

import { useForm, useWatch } from "react-hook-form";
import type { ZodType } from "zod";

import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/States";
import { useWallet } from "@/contexts/WalletContext";
import { env } from "@/config/env";
import { parseAmountToMinor } from "@/lib/format";
import {
  expenseFormSchema,
  incomeFormSchema,
  MAX_DESCRIPTION_BYTES,
} from "@/lib/schemas";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type TransactionDirection,
} from "@/types/treasury";
import { zodResolver } from "@/lib/zod-resolver";

export interface TransactionFormValues {
  amount: string;
  category: string;
  description: string;
}

export interface TransactionFormProps {
  direction: TransactionDirection;
  /**
   * Receives the amount already converted to integer minor units.
   *
   * Returns whether the record was written. Success is signalled by the return
   * value rather than by throwing: a rejected promise here would escape React
   * Hook Form's handler as an unhandled rejection, and the form needs to know
   * the outcome anyway so it can keep the treasurer's input on failure.
   */
  onSubmit: (input: {
    amountMinor: bigint;
    category: string;
    description: string;
  }) => Promise<boolean>;
  isSubmitting: boolean;
  submitError?: string | null;
}

export function TransactionForm({
  direction,
  onSubmit,
  isSubmitting,
  submitError,
}: TransactionFormProps) {
  const { status, isWrongNetwork, expectedNetwork } = useWallet();

  const isIncome = direction === "income";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Zod's output type is covariant, so the narrow category union assigns
  // cleanly to the wider `category: string` the form works with.
  const schema: ZodType<TransactionFormValues> = isIncome
    ? incomeFormSchema
    : expenseFormSchema;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", category: "", description: "" },
  });

  // `useWatch` rather than `watch()`: the latter returns a fresh function on
  // every render, which makes React Compiler bail out of memoizing this whole
  // component. useWatch returns a plain value and stays compiler-friendly.
  const description = useWatch({ control, name: "description" }) ?? "";
  const descriptionBytes = new TextEncoder().encode(description).length;

  const walletReady = status === "connected" && !isWrongNetwork;

  const submit = handleSubmit(async (values) => {
    const amountMinor = parseAmountToMinor(values.amount);
    // Already guaranteed by the schema; the check keeps the non-null assertion
    // out of the code path that actually writes to the chain.
    if (amountMinor === null) return;

    const recorded = await onSubmit({
      amountMinor,
      category: values.category,
      description: values.description.trim(),
    });

    // Only clear on success. Wiping a rejected submission would force the
    // treasurer to retype an amount they may no longer remember exactly.
    if (recorded) reset();
  });

  return (
    <Card className="max-w-xl">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field
          label={`Amount (${env.currency})`}
          error={errors.amount?.message}
          htmlFor="amount"
        >
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1250.00"
            aria-invalid={Boolean(errors.amount)}
            className="font-numeric w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            {...register("amount")}
          />
        </Field>

        <Field label="Category" error={errors.category?.message} htmlFor="category">
          <select
            id="category"
            aria-invalid={Boolean(errors.category)}
            className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            {...register("category")}
          >
            <option value="">Select a category…</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Description"
          error={errors.description?.message}
          htmlFor="description"
          hint={`${descriptionBytes}/${MAX_DESCRIPTION_BYTES} bytes`}
        >
          <textarea
            id="description"
            rows={3}
            placeholder={
              isIncome
                ? "Semester 1 membership dues, 100 members"
                : "Venue rental for orientation night"
            }
            aria-invalid={Boolean(errors.description)}
            className="w-full resize-y rounded-lg border border-border-default bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            {...register("description")}
          />
        </Field>

        {submitError && (
          <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">
            {submitError}
          </p>
        )}

        {/* Stated before the button, not in a toast afterwards. By the time a
            toast appears the record is already permanent. */}
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          This writes a permanent record to the Stellar ledger. It cannot be
          edited or deleted — mistakes are corrected by recording an offsetting{" "}
          {isIncome ? "expense" : "income"}.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!walletReady || isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Spinner label="Submitting" />}
            {isSubmitting ? "Recording…" : `Record ${direction}`}
          </button>

          {status !== "connected" && (
            <p className="text-sm text-foreground-muted">
              Connect the treasurer&apos;s wallet to submit.
            </p>
          )}
          {status === "connected" && isWrongNetwork && (
            <p className="text-sm text-warning">
              Switch Freighter to {expectedNetwork} to submit.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <span className="text-xs text-foreground-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
