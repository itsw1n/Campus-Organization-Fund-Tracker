"use client";

import { WatchWalletChanges } from "@stellar/freighter-api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  connect as connectWallet,
  isExpectedNetwork,
  isFreighterInstalled,
  restoreConnection,
  type WalletConnection,
} from "@/services/freighter";
import { env } from "@/config/env";

/**
 * An explicit state machine rather than a pile of booleans. `isLoading &&
 * !isConnected && hasError` combinations are how wallet UIs end up rendering
 * two contradictory things at once.
 */
export type WalletStatus =
  | "initializing" // checking for an existing session on mount
  | "unavailable" // extension not installed
  | "disconnected"
  | "connecting"
  | "connected";

interface WalletContextValue {
  status: WalletStatus;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  error: string | null;
  /** True when connected but pointed at the wrong network. */
  isWrongNetwork: boolean;
  expectedNetwork: string;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("initializing");
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore a prior session on mount. This runs in an effect (never during
  // render) because Freighter touches `window`, which does not exist while the
  // server renders this component's HTML.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!(await isFreighterInstalled())) {
        if (!cancelled) setStatus("unavailable");
        return;
      }

      const restored = await restoreConnection();
      if (cancelled) return;

      if (restored) {
        setConnection(restored);
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Freighter has no event emitter, so the SDK ships a poller. Without this,
  // a treasurer who switches accounts or flips to Mainnet mid-session keeps
  // seeing the old address while signing with the new one.
  useEffect(() => {
    if (status !== "connected") return;

    const watcher = new WatchWalletChanges();
    watcher.watch(({ address, network, networkPassphrase, error: watchError }) => {
      if (watchError) return;
      if (!address) {
        // The user revoked access from inside the extension.
        setConnection(null);
        setStatus("disconnected");
        return;
      }
      setConnection({ address, network, networkPassphrase });
    });

    return () => watcher.stop();
  }, [status]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    const result = await connectWallet();
    if (!result.ok) {
      setError(result.error);
      setStatus((previous) => (previous === "connecting" ? "disconnected" : previous));
      return;
    }

    setConnection(result.value);
    setStatus("connected");
  }, []);

  /**
   * Clears local session state only.
   *
   * Freighter exposes no programmatic revoke, so this cannot un-authorize the
   * site -- the user must do that from the extension. The UI copy says so
   * explicitly rather than implying a stronger guarantee than we can deliver.
   */
  const disconnect = useCallback(() => {
    setConnection(null);
    setError(null);
    setStatus("disconnected");
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address: connection?.address ?? null,
      network: connection?.network ?? null,
      networkPassphrase: connection?.networkPassphrase ?? null,
      error,
      isWrongNetwork:
        connection !== null && !isExpectedNetwork(connection.networkPassphrase),
      expectedNetwork: env.network,
      connect,
      disconnect,
    }),
    [status, connection, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside <WalletProvider>.");
  }
  return context;
}
