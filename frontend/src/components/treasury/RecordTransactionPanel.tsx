"use client";

import { useState } from "react";

import { TransactionForm } from "@/components/treasury/TransactionForm";
import { useWallet } from "@/contexts/WalletContext";
import { recordTransaction } from "@/services/treasury-write";
import type { TransactionDirection } from "@/types/treasury";

/**
 * Owns submission state for one recording form.
 *
 * Kept separate from <TransactionForm> so the form stays a pure presentation
 * component: it validates and reports values, and knows nothing about the
 * blockchain.
 */
export function RecordTransactionPanel({
  direction,
}: {
  direction: TransactionDirection;
}) {
  const { address } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedId, setRecordedId] = useState<number | null>(null);

  async function handleSubmit(input: {
    amountMinor: bigint;
    category: string;
    description: string;
  }): Promise<boolean> {
    if (!address) {
      setError("Connect the treasurer's wallet first.");
      return false;
    }

    setIsSubmitting(true);
    setError(null);
    setRecordedId(null);

    try {
      const id = await recordTransaction({ direction, ...input, publicKey: address });
      setRecordedId(id);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recording failed.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {recordedId !== null && (
        <p
          role="status"
          className="rounded-lg bg-success-subtle px-3 py-2 text-sm text-success"
        >
          Recorded permanently as transaction #{recordedId}.
        </p>
      )}

      <TransactionForm
        direction={direction}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={error}
      />
    </div>
  );
}
