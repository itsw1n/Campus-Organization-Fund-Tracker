import { formatAmount, formatTimestamp, truncateAddress } from "@/lib/format";
import type { TransactionView } from "@/types/treasury";

export function TransactionTable({ transactions }: { transactions: TransactionView[] }) {
  return (
    // Tables are the one thing that legitimately needs horizontal scroll on
    // mobile; the wrapper keeps the page body from scrolling sideways with it.
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface">
      <table className="w-full min-w-[42rem] text-sm">
        <caption className="sr-only">
          Transaction history, newest first
        </caption>
        <thead>
          <tr className="border-b border-border-default text-left text-xs uppercase tracking-wide text-foreground-muted">
            <th scope="col" className="px-4 py-3 font-medium">#</th>
            <th scope="col" className="px-4 py-3 font-medium">Date</th>
            <th scope="col" className="px-4 py-3 font-medium">Category</th>
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
            <th scope="col" className="px-4 py-3 font-medium">Recorded by</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const isIncome = transaction.direction === "income";
            return (
              <tr
                key={transaction.id}
                className="border-b border-border-default last:border-0"
              >
                <td className="font-numeric px-4 py-3 text-foreground-muted">
                  {transaction.id}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                  {formatTimestamp(transaction.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      isIncome
                        ? "bg-success-subtle text-success"
                        : "bg-danger-subtle text-danger"
                    }`}
                  >
                    {transaction.categoryLabel}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3">{transaction.description}</td>
                <td
                  className="font-numeric px-4 py-3 text-foreground-muted"
                  title={transaction.recordedBy}
                >
                  {truncateAddress(transaction.recordedBy)}
                </td>
                <td
                  className={`font-numeric px-4 py-3 text-right font-medium whitespace-nowrap ${
                    isIncome ? "text-success" : "text-danger"
                  }`}
                >
                  {/* The stored amount is always positive; the sign shown here
                      is derived from direction, so income and expense are
                      distinguishable at a glance without reading the category. */}
                  {isIncome ? "+" : "−"}
                  {formatAmount(transaction.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
