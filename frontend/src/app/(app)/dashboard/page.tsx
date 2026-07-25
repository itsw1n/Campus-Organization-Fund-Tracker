import type { Metadata } from "next";

import { OrganizationSetup } from "@/components/treasury/OrganizationSetup";
import { SummaryCards } from "@/components/treasury/SummaryCards";
import { ErrorState, NotDeployedState } from "@/components/ui/States";
import { isContractConfigured } from "@/config/env";
import { formatTimestamp, truncateAddress } from "@/lib/format";
import { getOrganization, getSummary } from "@/services/treasury";

export const metadata: Metadata = { title: "Dashboard" };

// The ledger changes whenever a transaction is recorded, so this page must not
// be baked at build time. Every request reads the current chain state.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isContractConfigured) {
    return (
      <div className="space-y-6">
        <Header />
        <NotDeployedState />
      </div>
    );
  }

  // These run on the SERVER: no wallet, no signature, no fee. That is what
  // makes the treasury publicly auditable by anyone with the link.
  let organization;
  let summary;
  try {
    [organization, summary] = await Promise.all([
      getOrganization(),
      getSummary(),
    ]);
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

  if (!organization) {
    return (
      <div className="space-y-6">
        <Header />
        <OrganizationSetup />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {organization.name}
          </h1>
          {organization.isArchived && (
            <span className="rounded-md bg-warning-subtle px-2 py-1 text-xs font-medium text-warning">
              Archived
            </span>
          )}
        </div>
        <p className="font-numeric mt-1 text-sm text-foreground-muted">
          Treasurer {truncateAddress(organization.treasurer)} · since{" "}
          {formatTimestamp(organization.createdAt)}
        </p>
      </div>

      <SummaryCards summary={summary} />

      <p className="text-xs text-foreground-muted">
        Read directly from the Stellar ledger at request time. No wallet
        required — anyone with this link sees the same numbers.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Live balances read directly from the Stellar ledger. No wallet needed.
      </p>
    </div>
  );
}
