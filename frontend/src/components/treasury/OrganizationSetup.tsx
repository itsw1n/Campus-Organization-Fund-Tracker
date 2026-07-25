"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/States";
import { useWallet } from "@/contexts/WalletContext";
import { initializeOrganization } from "@/services/treasury-write";
import { truncateAddress } from "@/lib/format";

/**
 * One-time setup: binds the deployed contract to an organization.
 *
 * This lives in the browser rather than in a deploy script because
 * `initialize` requires the treasurer's own signature. The wallet that signs
 * here becomes the only address that can ever record a transaction, and it is
 * written permanently -- there is no transfer function in the MVP.
 */
export function OrganizationSetup() {
  const router = useRouter();
  const { status, address, isWrongNetwork, expectedNetwork } = useWallet();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletReady = status === "connected" && address && !isWrongNetwork;
  const trimmedName = name.trim();
  const canSubmit = walletReady && trimmedName.length > 0 && !isSubmitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!address || !canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await initializeOrganization(trimmedName, address);
      // Re-render the server component so it picks up the now-initialized
      // organization instead of showing this form again.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Setup failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-xl space-y-4">
      <div>
        <h2 className="font-medium">Set up your organization</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          The contract is deployed but not yet bound to an organization. This
          runs once.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="org-name" className="text-sm font-medium">
            Organization name
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Computer Science Society"
            autoComplete="organization"
            className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <div className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          {walletReady ? (
            <>
              <span className="font-numeric">{truncateAddress(address)}</span>{" "}
              becomes the treasurer. This is permanent — the name cannot be
              renamed and the treasurer cannot be transferred in this version.
            </>
          ) : (
            <>
              The connected wallet becomes the permanent treasurer, so make sure
              the right account is selected before signing.
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Spinner label="Creating" />}
            {isSubmitting ? "Creating…" : "Create organization"}
          </button>

          {status !== "connected" && (
            <p className="text-sm text-foreground-muted">
              Connect a wallet to continue.
            </p>
          )}
          {status === "connected" && isWrongNetwork && (
            <p className="text-sm text-warning">
              Switch Freighter to {expectedNetwork}.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
