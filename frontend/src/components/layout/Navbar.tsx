import Link from "next/link";

import { WalletButton } from "@/components/wallet/WalletButton";
import { env } from "@/config/env";

// Server Component. Only the wallet button inside it is interactive, so the
// header costs almost nothing in client JavaScript.
export function Navbar() {
  return (
    <header className="border-b border-border-default bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            TreasuryChain
          </Link>
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted">
            {env.network}
          </span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
