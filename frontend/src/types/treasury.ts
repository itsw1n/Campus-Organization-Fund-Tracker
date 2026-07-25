/**
 * UI-facing view of the contract's domain.
 *
 * The `value` strings MUST match the Rust enum variant names exactly, because
 * that is what the generated bindings emit as the discriminant `tag` for a
 * Soroban unit enum. The human labels are purely a UI concern and are
 * deliberately kept out of the contract -- renaming a label should never
 * require a redeploy.
 */

export const INCOME_CATEGORIES = [
  { value: "MembershipFee", label: "Membership fee" },
  { value: "Donation", label: "Donation" },
  { value: "Sponsorship", label: "Sponsorship" },
  { value: "Merchandise", label: "Merchandise sale" },
  { value: "EventRegistration", label: "Event registration" },
  { value: "Other", label: "Other" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "Food", label: "Food" },
  { value: "Venue", label: "Venue" },
  { value: "Equipment", label: "Equipment" },
  { value: "Transportation", label: "Transportation" },
  { value: "Marketing", label: "Marketing" },
  { value: "Supplies", label: "Supplies" },
  { value: "Printing", label: "Printing" },
  { value: "Other", label: "Other" },
] as const;

export type IncomeCategoryValue = (typeof INCOME_CATEGORIES)[number]["value"];
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];

export type TransactionDirection = "income" | "expense";

/**
 * A transaction flattened for display.
 *
 * The contract's nested `Category::Income(IncomeCategory)` is split into
 * `direction` + `categoryLabel` here so table cells and totals do not each
 * re-implement the same unwrapping logic.
 */
export interface TransactionView {
  id: number;
  direction: TransactionDirection;
  categoryLabel: string;
  /** Minor units. Always positive; direction carries the sign. */
  amount: bigint;
  description: string;
  /** Unix seconds. */
  timestamp: bigint;
  recordedBy: string;
}

export interface SummaryView {
  totalIncome: bigint;
  totalExpenses: bigint;
  txCount: number;
}

export function balanceOf(summary: SummaryView): bigint {
  return summary.totalIncome - summary.totalExpenses;
}

const INCOME_LABELS = new Map<string, string>(
  INCOME_CATEGORIES.map((category) => [category.value, category.label]),
);
const EXPENSE_LABELS = new Map<string, string>(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
);

/**
 * Falls back to the raw tag rather than throwing. If the contract ever gains a
 * category the frontend hasn't been taught about, the ledger should still
 * render -- an unreadable row is far better than a blank page.
 */
export function categoryLabel(
  direction: TransactionDirection,
  tag: string,
): string {
  const labels = direction === "income" ? INCOME_LABELS : EXPENSE_LABELS;
  return labels.get(tag) ?? tag;
}
