import type { ReactNode } from "react";

import { Card } from "./Card";

/**
 * Loading, empty, and error are three distinct states and each gets its own
 * component here. Collapsing them (the classic `{data ? <Table/> : <Spinner/>}`)
 * means an empty treasury and a failed RPC call look identical to the user --
 * one is fine, the other needs action.
 */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block size-4 animate-spin rounded-full border-2 border-border-default border-t-brand"
    />
  );
}

export function LoadingState({ message = "Reading the ledger…" }: { message?: string }) {
  return (
    <Card className="flex items-center justify-center gap-3 py-12">
      <Spinner />
      <p className="text-sm text-foreground-muted">{message}</p>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-foreground-muted text-pretty">
        {description}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-danger/30 bg-danger-subtle">
      <p className="font-medium text-danger">{title}</p>
      <p className="mt-1 text-sm text-foreground-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-8 items-center rounded-lg border border-border-default bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          Try again
        </button>
      )}
    </Card>
  );
}

/** Shown across the app until NEXT_PUBLIC_CONTRACT_ID is set. */
export function NotDeployedState() {
  return (
    <EmptyState
      title="No treasury contract configured"
      description="Deploy the TreasuryChain contract to Testnet, then set NEXT_PUBLIC_CONTRACT_ID in .env.local and restart the dev server."
    />
  );
}
