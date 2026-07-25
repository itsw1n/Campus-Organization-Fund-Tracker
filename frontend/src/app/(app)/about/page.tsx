import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How it works</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          What this system guarantees, and what it doesn&apos;t.
        </p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-medium">What is guaranteed</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground-muted">
          <li>
            Every record is written to the Stellar ledger with the ledger&apos;s
            own timestamp and the wallet address that signed it.
          </li>
          <li>
            There is no edit function and no delete function. Not for members,
            not for officers, not for whoever deployed the contract.
          </li>
          <li>
            Anyone can read the full history without an account, a wallet, or
            permission from the treasurer.
          </li>
          <li>
            History survives leadership handover. A new treasurer inherits the
            record; they cannot rewrite it.
          </li>
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">What is not guaranteed</h2>
        <p className="text-sm text-foreground-muted">
          This is a <strong className="text-foreground">ledger</strong>, not a{" "}
          <strong className="text-foreground">vault</strong>. The organization&apos;s
          actual money still moves as cash, bank transfer, or e-wallet. The
          contract records that a transaction happened; it does not hold or move
          the funds itself.
        </p>
        <p className="text-sm text-foreground-muted">
          So the treasurer still attests to the underlying amounts. What changes
          is that their attestation becomes permanent, timestamped, attributable,
          and impossible to quietly revise later — which is exactly where
          spreadsheets fail.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Corrections</h2>
        <p className="text-sm text-foreground-muted">
          Mistakes are fixed the way accountants have fixed them for centuries:
          by recording an offsetting entry, so both the error and the correction
          stay visible. A ledger you can quietly edit is just a spreadsheet
          with extra steps.
        </p>
      </Card>
    </div>
  );
}
