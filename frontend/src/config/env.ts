import { z } from "zod";

/**
 * Network passphrases are consensus-critical: sign against the wrong one and
 * the network rejects the transaction. These values are copied from the SDK's
 * `Networks` enum, kept as plain constants here so that importing config does
 * not drag the (large) Stellar SDK into every client bundle.
 */
const NETWORK_PASSPHRASES = {
  TESTNET: "Test SDF Network ; September 2015",
  PUBLIC: "Public Global Stellar Network ; September 2015",
} as const;

/** Soroban contract IDs are strkeys: "C" followed by 55 base32 characters. */
const contractIdSchema = z
  .string()
  .regex(/^C[A-Z2-7]{55}$/, "must be a valid Soroban contract ID");

const schema = z.object({
  network: z.enum(["TESTNET", "PUBLIC"]).default("TESTNET"),
  rpcUrl: z.url("must be a valid URL"),
  // Empty is allowed on purpose: before the first deploy there is no contract
  // yet, and the app should render an informative empty state rather than
  // refuse to boot.
  contractId: z.union([contractIdSchema, z.literal("")]).default(""),
  currency: z.string().min(3).max(3).default("USD"),
});

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time by literal textual
 * match. They must be written out in full -- `process.env[key]` with a
 * computed key silently yields undefined in the browser.
 */
const parsed = schema.safeParse({
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID,
  currency: process.env.NEXT_PUBLIC_CURRENCY,
});

if (!parsed.success) {
  // Fail loudly at module load rather than surfacing as a confusing runtime
  // error three screens deep into the app.
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  ...parsed.data,
  networkPassphrase: NETWORK_PASSPHRASES[parsed.data.network],
} as const;

/** False until the contract has been deployed and its ID written to .env.local. */
export const isContractConfigured = env.contractId !== "";
