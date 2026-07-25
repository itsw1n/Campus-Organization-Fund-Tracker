"use client";

import { useWallet } from "@/contexts/WalletContext";
import { truncateAddress } from "@/lib/format";

/**
 * Renders every wallet state explicitly. Each branch is a real situation a
 * user hits during a demo -- extension missing, wrong network, rejected
 * prompt -- and each one gets an actionable message rather than a spinner
 * that never resolves.
 */
export function WalletButton() {
  const {
    status,
    address,
    network,
    error,
    isWrongNetwork,
    expectedNetwork,
    connect,
    disconnect,
  } = useWallet();

  if (status === "initializing") {
    return (
      <div
        className="h-9 w-36 animate-pulse rounded-lg bg-surface-muted"
        aria-label="Checking wallet"
      />
    );
  }

  if (status === "unavailable") {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center rounded-lg border border-border-default px-3 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
      >
        Install Freighter
      </a>
    );
  }

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-2">
        {isWrongNetwork && (
          <span
            className="rounded-md bg-warning-subtle px-2 py-1 text-xs font-medium text-warning"
            title={`This app expects ${expectedNetwork}. Switch networks in Freighter.`}
          >
            Wrong network: {network}
          </span>
        )}
        <button
          type="button"
          onClick={disconnect}
          // The tooltip is doing real work: "Disconnect" cannot actually
          // revoke access, and pretending otherwise is a trust problem in an
          // app whose entire premise is transparency.
          title="Forget this wallet in the app. To fully revoke access, remove this site from Freighter's connected sites."
          className="font-numeric inline-flex h-9 items-center gap-2 rounded-lg border border-border-default bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          <span className="size-2 rounded-full bg-success" aria-hidden />
          {truncateAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void connect()}
        disabled={status === "connecting"}
        className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
