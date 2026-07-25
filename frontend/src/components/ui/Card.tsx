import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border-default bg-surface p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A single headline figure (balance, total income, transaction count).
 *
 * `tone` maps to the design system's semantic colors rather than taking a raw
 * color, so "money out is red" is decided once here instead of at each call
 * site where it could drift.
 */
export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "brand";
  hint?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-success",
    negative: "text-danger",
    brand: "text-brand",
  }[tone];

  return (
    <Card>
      <p className="text-sm font-medium text-foreground-muted">{label}</p>
      <p className={`font-numeric mt-2 text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
    </Card>
  );
}
