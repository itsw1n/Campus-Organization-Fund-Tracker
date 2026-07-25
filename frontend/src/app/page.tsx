import Link from "next/link";

import { WalletButton } from "@/components/wallet/WalletButton";
import { env, isContractConfigured } from "@/config/env";

// This page is a Server Component. Only <WalletButton> ships JavaScript to the
// browser -- the copy, layout, and links are rendered to HTML on the server.
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">TreasuryChain</span>
        <WalletButton />
      </header>

      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Every amount in, every amount out — permanently on the record.
        </h1>
        <p className="max-w-xl text-lg text-foreground-muted text-pretty">
          Student organizations run on trust and spreadsheets. TreasuryChain
          replaces the spreadsheet with an append-only ledger on Stellar, so
          members can verify the books themselves — no account, no wallet, no
          asking the treasurer.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            View the treasury
          </Link>
          <Link
            href="/about"
            className="inline-flex h-10 items-center rounded-lg border border-border-default px-5 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            How it works
          </Link>
        </div>
      </div>

      <footer className="border-t border-border-default pt-6 text-sm text-foreground-muted">
        {isContractConfigured ? (
          <p className="font-numeric">
            Connected to Stellar {env.network} · contract{" "}
            <code className="text-xs">{env.contractId}</code>
          </p>
        ) : (
          <p>
            No contract deployed yet. Deploy the treasury contract and set{" "}
            <code className="text-xs">NEXT_PUBLIC_CONTRACT_ID</code> in{" "}
            <code className="text-xs">.env.local</code>.
          </p>
        )}
      </footer>
    </main>
  );
}
