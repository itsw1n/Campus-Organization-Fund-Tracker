import { env, isContractConfigured } from "@/config/env";

export function Footer() {
  return (
    <footer className="border-t border-border-default py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 text-xs text-foreground-muted">
        <p>
          TreasuryChain — an append-only treasury ledger on Stellar. Records are
          permanent and publicly auditable; this app does not custody funds.
        </p>
        {isContractConfigured && (
          <p className="font-numeric">
            {env.network} · <code>{env.contractId}</code>
          </p>
        )}
      </div>
    </footer>
  );
}
