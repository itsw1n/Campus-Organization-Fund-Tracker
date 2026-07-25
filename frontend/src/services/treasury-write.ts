import "client-only";

import {
  Client,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/contracts/treasury";
import { sign } from "@/services/freighter";
import { baseClientOptions, toTreasuryError } from "@/services/treasury";
import type { TransactionDirection } from "@/types/treasury";

/**
 * Write path: everything that needs a signature.
 *
 * Split from treasury.ts because it imports the Freighter wrapper, which is
 * `client-only`. Keeping the two apart is what lets the dashboard and
 * transaction pages render on the server while writes stay in the browser.
 */

/** Client that can submit. Requires the connected treasurer's address. */
function writeClient(publicKey: string): Client {
  return new Client({
    ...baseClientOptions(),
    publicKey,
    // Freighter's signTransaction matches the SDK's SignTransaction type
    // exactly, so it drops in with no adapter.
    signTransaction: sign,
  });
}

export interface RecordTransactionInput {
  direction: TransactionDirection;
  amountMinor: bigint;
  /** The Rust enum variant name, e.g. "MembershipFee". */
  category: string;
  description: string;
  /** The connected treasurer's address. */
  publicKey: string;
}

export async function recordTransaction(
  input: RecordTransactionInput,
): Promise<number> {
  const client = writeClient(input.publicKey);

  try {
    // The generated unit-enum shape is { tag, values: void }. The cast narrows
    // a plain string from the form to the generated tag union; the value is
    // guaranteed to be one of them because the form's <select> options and the
    // Zod enum are both built from the same list in types/treasury.ts.
    const assembled =
      input.direction === "income"
        ? await client.record_income({
            category: {
              tag: input.category as IncomeCategory["tag"],
              values: undefined,
            },
            amount: input.amountMinor,
            description: input.description,
          })
        : await client.record_expense({
            category: {
              tag: input.category as ExpenseCategory["tag"],
              values: undefined,
            },
            amount: input.amountMinor,
            description: input.description,
          });

    const { result } = await assembled.signAndSend();
    return result.unwrap();
  } catch (error) {
    throw toTreasuryError(error);
  }
}

/**
 * Binds this contract to an organization. Runs exactly once, and must be
 * signed by the treasurer themselves -- which is why it lives here and not in
 * a deploy script.
 */
export async function initializeOrganization(
  name: string,
  treasurer: string,
): Promise<void> {
  const client = writeClient(treasurer);

  try {
    const assembled = await client.initialize({ name, treasurer });
    const { result } = await assembled.signAndSend();
    result.unwrap();
  } catch (error) {
    throw toTreasuryError(error);
  }
}
