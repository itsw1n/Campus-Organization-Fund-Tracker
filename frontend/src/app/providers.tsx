"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { WalletProvider } from "@/contexts/WalletContext";

export function Providers({ children }: { children: ReactNode }) {
  // Created in state, not at module scope. A module-level QueryClient is
  // shared across every request on the server, which would leak one user's
  // cached data into another's response.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Ledger data only changes when someone records a transaction, and
            // finality takes a few seconds. Refetching on every window focus
            // just burns RPC quota.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>{children}</WalletProvider>
    </QueryClientProvider>
  );
}
