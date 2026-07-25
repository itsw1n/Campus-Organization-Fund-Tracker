import type { Metadata } from "next";

import { TransactionTable } from "@/components/treasury/TransactionTable";
import { EmptyState, ErrorState, NotDeployedState } from "@/components/ui/States";
import { isContractConfigured } from "@/config/env";
import { getTransactions } from "@/services/treasury";

export const metadata: Metadata = { title: "Transactions" };

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  if (!isContractConfigured) {
    return (
      <div className="space-y-6">
        <Header />
        <NotDeployedState />
      </div>
    );
  }

  let transactions;
  try {
    // cursor 0 == start from the newest record. Capped at the contract's
    // MAX_PAGE_LIMIT of 50.
    transactions = await getTransactions(0, 25);
  } catch (error) {
    return (
      <div className="space-y-6">
        <Header />
        <ErrorState
          title="Could not read the ledger"
          message={
            error instanceof Error
              ? error.message
              : "The Soroban RPC endpoint did not respond."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />
      {transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Once the treasurer records income or an expense, it appears here permanently."
        />
      ) : (
        <TransactionTable transactions={transactions} />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Every record ever written, newest first. Nothing here can be edited or
        deleted — by anyone.
      </p>
    </div>
  );
}
