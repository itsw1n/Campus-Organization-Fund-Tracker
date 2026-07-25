import type { Metadata } from "next";

import { RecordSection } from "@/components/treasury/RecordSection";

export const metadata: Metadata = { title: "Record income" };

// Whether a write is even possible depends on live chain state, so this page
// cannot be prerendered at build time.
export const dynamic = "force-dynamic";

export default function IncomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record income</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Money received by the organization. Once submitted this record is
          permanent — correct mistakes with an offsetting expense, not an edit.
        </p>
      </div>

      <RecordSection direction="income" />
    </div>
  );
}
