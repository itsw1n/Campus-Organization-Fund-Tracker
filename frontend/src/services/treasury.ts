import {
  Client,
  type Transaction as ContractTransaction,
} from "@/contracts/treasury";
import { env, isContractConfigured } from "@/config/env";
import {
  categoryLabel,
  type SummaryView,
  type TransactionDirection,
  type TransactionView,
} from "@/types/treasury";

/**
 * The single boundary between the UI and the blockchain.
 *
 * Everything above this file works with plain values and knows nothing about
 * XDR, simulation, or signing.
 */

export class ContractNotConfiguredError extends Error {
  constructor() {
    super(
      "No treasury contract is configured. Set NEXT_PUBLIC_CONTRACT_ID in .env.local.",
    );
    this.name = "ContractNotConfiguredError";
  }
}

/** Thrown when the contract rejected the call with one of its own error codes. */
export class TreasuryContractError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "TreasuryContractError";
  }
}

/** Mirrors the discriminants in the contract's error.rs. Never renumber. */
const ERROR_MESSAGES: Record<number, string> = {
  1: "This organization has already been set up.",
  2: "This treasury has not been set up yet.",
  3: "Only the treasurer can do that.",
  4: "Amount must be greater than zero.",
  5: "The books are archived — no new records can be added.",
  6: "That transaction does not exist.",
  7: "Invalid page size.",
  8: "Description is too long.",
  9: "Amount is too large to record.",
};

export const NOT_INITIALIZED = 2;

/**
 * Extracts a contract error code from a thrown host error.
 *
 * A Rust `Err` return escalates to a failed invocation rather than resolving
 * as an `Err` value, so these arrive as exceptions whose message embeds
 * `Error(Contract, #N)`. Pattern-matching a message string is admittedly
 * brittle, but the SDK surfaces no structured code here, and the alternative
 * -- treating every failure as unknown -- would lose the distinction between
 * "not set up yet" (an expected first-run state) and a genuine fault.
 */
export function contractErrorCode(error: unknown): number | null {
  const match = /Error\(Contract,\s*#(\d+)\)/.exec(String(error));
  return match ? Number(match[1]) : null;
}

export function toTreasuryError(error: unknown): unknown {
  const code = contractErrorCode(error);
  if (code === null) return error;
  return new TreasuryContractError(
    code,
    ERROR_MESSAGES[code] ?? `The contract rejected this request (code ${code}).`,
  );
}

export function requireContractId(): string {
  if (!isContractConfigured) throw new ContractNotConfiguredError();
  return env.contractId;
}

/**
 * Connection settings shared by the read and write clients.
 *
 * NOTE: this module must stay free of any `client-only` import (notably the
 * Freighter wrapper). Reads run in React Server Components, and pulling a
 * browser-only module into that graph fails the build. Signing lives in
 * treasury-write.ts for exactly this reason.
 */
export function baseClientOptions() {
  return {
    contractId: requireContractId(),
    networkPassphrase: env.networkPassphrase,
    rpcUrl: env.rpcUrl,
  };
}

/**
 * Read-only client. No wallet, no signature, no fee.
 *
 * This is what makes the treasury publicly auditable: reads run as
 * simulations, so anyone can call them without an account.
 */
function readClient(): Client {
  return new Client(baseClientOptions());
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toTransactionView(tx: ContractTransaction): TransactionView {
  const direction: TransactionDirection =
    tx.category.tag === "Income" ? "income" : "expense";
  // Both Category variants carry exactly one payload: the inner category enum.
  const innerTag = tx.category.values[0].tag;

  return {
    id: tx.id,
    direction,
    categoryLabel: categoryLabel(direction, innerTag),
    amount: tx.amount,
    description: tx.description,
    timestamp: tx.timestamp,
    recordedBy: tx.recorded_by,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSummary(): Promise<SummaryView> {
  try {
    const tx = await readClient().get_summary();
    return {
      totalIncome: tx.result.total_income,
      totalExpenses: tx.result.total_expenses,
      txCount: tx.result.tx_count,
    };
  } catch (error) {
    throw toTreasuryError(error);
  }
}

export interface OrganizationView {
  name: string;
  treasurer: string;
  createdAt: bigint;
  isArchived: boolean;
}

/**
 * Returns null when the contract is deployed but not yet initialized, rather
 * than throwing. That is a normal first-run state, and the UI renders the
 * setup form for it.
 */
export async function getOrganization(): Promise<OrganizationView | null> {
  try {
    const tx = await readClient().get_organization();

    // Inspect the Result instead of calling unwrap() and catching the throw.
    // Reading the contract: get_organization's ONLY possible error is
    // NotInitialized, so an Err here unambiguously means "not set up yet" --
    // no need to parse an error code out of a message string.
    if (tx.result.isErr()) return null;

    const org = tx.result.unwrap();
    return {
      name: org.name,
      treasurer: org.treasurer,
      createdAt: org.created_at,
      isArchived: org.status.tag === "Archived",
    };
  } catch (error) {
    // A thrown error here is a transport/simulation failure, not a contract
    // rejection -- surface it rather than pretending the org is missing.
    if (contractErrorCode(error) === NOT_INITIALIZED) return null;
    throw toTreasuryError(error);
  }
}

export async function getTransactions(
  cursor = 0,
  limit = 25,
): Promise<TransactionView[]> {
  try {
    const tx = await readClient().get_transactions({ cursor, limit });

    // The contract can only reject this with InvalidLimit or NotInitialized.
    // Callers here always pass a limit within MAX_PAGE_LIMIT, so an Err means
    // the treasury simply has not been set up yet -- an empty list, not a
    // failure.
    if (tx.result.isErr()) return [];

    return tx.result.unwrap().map(toTransactionView);
  } catch (error) {
    if (contractErrorCode(error) === NOT_INITIALIZED) return [];
    throw toTreasuryError(error);
  }
}

// Writes live in treasury-write.ts -- they need the Freighter signer, which
// is client-only and must not enter the server module graph.
