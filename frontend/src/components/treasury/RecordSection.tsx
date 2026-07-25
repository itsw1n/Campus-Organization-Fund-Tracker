import Link from "next/link";

import { RecordTransactionPanel } from "@/components/treasury/RecordTransactionPanel";
import { EmptyState, ErrorState, NotDeployedState } from "@/components/ui/States";
import { isContractConfigured } from "@/config/env";
import { getOrganization } from "@/services/treasury";
import type { TransactionDirection } from "@/types/treasury";

/**
 * Server-side guard for the recording forms.
 *
 * Checks on the server whether the treasury can actually accept a write before
 * rendering a form that invites one. Without this the user fills in an amount,
 * signs nothing, and gets a raw `Error(Contract, #2)` back from the RPC --
 * technically correct, completely unhelpful.
 */
export async function RecordSection({
  direction,
}: {
  direction: TransactionDirection;
}) {
  if (!isContractConfigured) return <NotDeployedState />;

  let organization;
  try {
    organization = await getOrganization();
  } catch (error) {
    return (
      <ErrorState
        title="Could not reach the treasury"
        message={
          error instanceof Error
            ? error.message
            : "The Soroban RPC endpoint did not respond."
        }
      />
    );
  }

  if (!organization) {
    return (
      <EmptyState
        title="Set up the organization first"
        description="This contract is deployed but has no organization yet, so there is no treasurer authorized to record anything. Create the organization once, then come back."
        action={
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            Go to setup
          </Link>
        }
      />
    );
  }

  if (organization.isArchived) {
    return (
      <EmptyState
        title="The books are closed"
        description={`${organization.name} has been archived. Its history stays readable forever, but no new records can be added.`}
        action={
          <Link
            href="/transactions"
            className="inline-flex h-9 items-center rounded-lg border border-border-default px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            View history
          </Link>
        }
      />
    );
  }

  return <RecordTransactionPanel direction={direction} />;
}
