import { StatCard } from "@/components/ui/Card";
import { formatAmount } from "@/lib/format";
import { balanceOf, type SummaryView } from "@/types/treasury";

export function SummaryCards({ summary }: { summary: SummaryView }) {
  const balance = balanceOf(summary);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Current balance"
        value={formatAmount(balance)}
        // A negative balance is surfaced in red rather than hidden or clamped:
        // overspending is precisely what members need to be able to see.
        tone={balance < 0n ? "negative" : "brand"}
        hint={balance < 0n ? "Spending exceeds income" : undefined}
      />
      <StatCard
        label="Total income"
        value={formatAmount(summary.totalIncome)}
        tone="positive"
      />
      <StatCard
        label="Total expenses"
        value={formatAmount(summary.totalExpenses)}
        tone="negative"
      />
      <StatCard
        label="Transactions"
        value={String(summary.txCount)}
        hint="Permanent records"
      />
    </div>
  );
}
