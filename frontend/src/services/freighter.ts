import "client-only";

import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";

import { env } from "@/config/env";

/**
 * IMPORTANT: every function in @stellar/freighter-api resolves with an object
 * shaped `{ ...data, error?: FreighterApiError }`. They do NOT throw on
 * failure. Wrapping them in try/catch alone would swallow every error
 * silently, so each call below explicitly inspects `.error`.
 *
 * This module normalises that into a discriminated union so callers cannot
 * forget to handle the failure case -- TypeScript won't let them read `.value`
 * without narrowing first.
 */
export type WalletResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function ok<T>(value: T): WalletResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): WalletResult<T> {
  return { ok: false, error };
}

/** Freighter errors are objects; coerce whatever we get into a readable string. */
function messageOf(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === "string") return message;
  }
  return fallback;
}

export interface WalletConnection {
  address: string;
  network: string;
  networkPassphrase: string;
}

/**
 * Whether the Freighter extension is installed.
 *
 * Naming trap: Freighter's `isConnected()` reports EXTENSION PRESENCE, not
 * whether this site is authorized. Site authorization is `isAllowed()`.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    if (result.error) return false;
    return result.isConnected;
  } catch {
    // Throws rather than resolves when no extension is injected at all.
    return false;
  }
}

/** Whether the user has previously authorized this site. */
export async function isSiteAllowed(): Promise<boolean> {
  const result = await isAllowed();
  if (result.error) return false;
  return result.isAllowed;
}

async function readNetwork(): Promise<WalletResult<{ network: string; networkPassphrase: string }>> {
  const result = await getNetwork();
  if (result.error) {
    return fail(messageOf(result.error, "Could not read the wallet's network."));
  }
  return ok({
    network: result.network,
    networkPassphrase: result.networkPassphrase,
  });
}

/**
 * Restores an existing session WITHOUT prompting the user.
 *
 * Returns null when the site is not yet authorized, so the UI can show
 * "Connect wallet" instead of firing an unsolicited popup on page load.
 */
export async function restoreConnection(): Promise<WalletConnection | null> {
  if (!(await isFreighterInstalled())) return null;
  if (!(await isSiteAllowed())) return null;

  const addressResult = await getAddress();
  if (addressResult.error || !addressResult.address) return null;

  const networkResult = await readNetwork();
  if (!networkResult.ok) return null;

  return { address: addressResult.address, ...networkResult.value };
}

/** Prompts the user to authorize this site and share their address. */
export async function connect(): Promise<WalletResult<WalletConnection>> {
  if (!(await isFreighterInstalled())) {
    return fail("Freighter is not installed. Install it from freighter.app.");
  }

  // `setAllowed` asks for site permission; `requestAccess` returns the address
  // the user selected. Both can be rejected by the user, and rejection arrives
  // as `.error` rather than as an exception.
  const allowedResult = await setAllowed();
  if (allowedResult.error) {
    return fail(messageOf(allowedResult.error, "Connection request was rejected."));
  }

  const accessResult = await requestAccess();
  if (accessResult.error || !accessResult.address) {
    return fail(messageOf(accessResult.error, "Connection request was rejected."));
  }

  const networkResult = await readNetwork();
  if (!networkResult.ok) return fail(networkResult.error);

  return ok({ address: accessResult.address, ...networkResult.value });
}

/**
 * Signs a transaction envelope.
 *
 * The returned shape is intentionally identical to the Stellar SDK's
 * `SignTransaction` type, so this function can be handed straight to
 * `contract.Client` as its signer with no adapter layer.
 */
export async function sign(
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
): Promise<{ signedTxXdr: string; signerAddress: string }> {
  const result = await signTransaction(xdr, {
    networkPassphrase: opts?.networkPassphrase ?? env.networkPassphrase,
    address: opts?.address,
  });

  if (result.error) {
    // The SDK's signing path expects a throw here, so this is the one place we
    // deliberately convert Freighter's error object back into an exception.
    throw new Error(messageOf(result.error, "Transaction signing was rejected."));
  }

  return { signedTxXdr: result.signedTxXdr, signerAddress: result.signerAddress };
}

/** True when the wallet is pointed at the network this app was built for. */
export function isExpectedNetwork(networkPassphrase: string): boolean {
  return networkPassphrase === env.networkPassphrase;
}
