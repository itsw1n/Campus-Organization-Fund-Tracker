import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCZRC7FSERFG7HWCWO4BCMY6EKMGP5AQEN4ZCPOCT3VQVF63C3AYPF75",
  }
} as const

export const TreasuryError = {
  /**
   * `initialize` was called on a contract that already has an organization.
   */
  1: {message:"AlreadyInitialized"},
  /**
   * Any call before `initialize` has run.
   */
  2: {message:"NotInitialized"},
  /**
   * Caller is not the stored treasurer.
   */
  3: {message:"NotTreasurer"},
  /**
   * Amount was zero or negative. Money must move in one direction only.
   */
  4: {message:"InvalidAmount"},
  /**
   * Organization is archived; the books are closed to new writes.
   */
  5: {message:"OrgArchived"},
  /**
   * Requested transaction id does not exist.
   */
  6: {message:"TxNotFound"},
  /**
   * Pagination `limit` was zero or above the hard cap.
   */
  7: {message:"InvalidLimit"},
  /**
   * Description exceeded the on-chain length budget.
   */
  8: {message:"DescriptionTooLong"},
  /**
   * A running total would have exceeded i128. Practically unreachable, but
   * failing loudly beats writing a wrapped, permanently wrong number.
   */
  9: {message:"AmountOverflow"}
}


/**
 * Running totals, maintained incrementally on every write.
 * 
 * This exists so the dashboard is a single O(1) read instead of a scan over
 * every transaction ever recorded. `balance` is intentionally NOT stored --
 * it is derived, and storing derived state is how ledgers drift.
 */
export interface Summary {
  total_expenses: i128;
  total_income: i128;
  tx_count: u32;
}

/**
 * The direction of a transaction *and* its category, as a single value.
 * 
 * Deliberately NOT two separate fields (`tx_type` + `category`). Splitting
 * them would allow a record that claims to be Income while carrying the
 * `Food` category -- a state that is meaningless but representable, and
 * therefore one that eventually gets written by accident and is then
 * permanent. Here that state cannot be constructed at all.
 */
export type Category = {tag: "Income", values: readonly [IncomeCategory]} | {tag: "Expense", values: readonly [ExpenseCategory]};

/**
 * Lifecycle state of the organization.
 * 
 * `Archived` lets a graduating batch freeze the books without deleting
 * history -- new writes are rejected, but every read still works forever.
 */
export type OrgStatus = {tag: "Active", values: void} | {tag: "Archived", values: void};


/**
 * A single, permanent financial record.
 * 
 * `amount` is always POSITIVE. Direction is carried by `category`, never by
 * the sign of the amount -- signed amounts invite double-negation bugs when
 * summing, and a negative "income" would be nonsense that cannot be undone.
 */
export interface Transaction {
  /**
 * Minor units (e.g. 123456 == 1,234.56). Never a float.
 */
amount: i128;
  category: Category;
  description: string;
  /**
 * Sequential, starting at 1. Doubles as the storage key.
 */
id: u32;
  /**
 * The wallet that signed this record. This is the accountability anchor.
 */
recorded_by: string;
  /**
 * Ledger close time in unix seconds -- the client cannot forge this.
 */
timestamp: u64;
}


/**
 * The organization this contract instance belongs to.
 * 
 * There is exactly one of these per deployed contract, stored in instance
 * storage. That is why there is no `org_id` field: the contract address
 * *is* the organization ID.
 */
export interface Organization {
  /**
 * Unix seconds, taken from the ledger close time -- not from the client.
 */
created_at: u64;
  name: string;
  status: OrgStatus;
  /**
 * The only address permitted to record transactions.
 */
treasurer: string;
}

/**
 * Where money came from.
 */
export type IncomeCategory = {tag: "MembershipFee", values: void} | {tag: "Donation", values: void} | {tag: "Sponsorship", values: void} | {tag: "Merchandise", values: void} | {tag: "EventRegistration", values: void} | {tag: "Other", values: void};

/**
 * Where money went.
 */
export type ExpenseCategory = {tag: "Food", values: void} | {tag: "Venue", values: void} | {tag: "Equipment", values: void} | {tag: "Transportation", values: void} | {tag: "Marketing", values: void} | {tag: "Supplies", values: void} | {tag: "Printing", values: void} | {tag: "Other", values: void};




export type DataKey = {tag: "Org", values: void} | {tag: "Summary", values: void} | {tag: "Tx", values: readonly [u32]};

export interface Client {
  /**
   * Construct and simulate a archive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Closes the books to new writes. Reads keep working forever.
   * 
   * Intended for end-of-term handover: the outgoing treasurer freezes their
   * record so nothing can be appended to their tenure after the fact.
   */
  archive: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Binds this contract instance to one organization. Callable exactly once.
   * 
   * Requires the treasurer's own signature: this proves the address is real
   * and consents to the role, instead of letting a deployer nominate a
   * typo'd address that can never record anything.
   */
  initialize: ({name, treasurer}: {name: string, treasurer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current balance == total income - total expenses.
   */
  get_balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_summary transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_summary: (options?: MethodOptions) => Promise<AssembledTransaction<Summary>>

  /**
   * Construct and simulate a record_income transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records money received. Returns the new transaction id.
   */
  record_income: ({category, amount, description}: {category: IncomeCategory, amount: i128, description: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a record_expense transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records money spent. Returns the new transaction id.
   */
  record_expense: ({category, amount, description}: {category: ExpenseCategory, amount: i128, description: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a get_transaction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_transaction: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Transaction>>>

  /**
   * Construct and simulate a get_organization transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_organization: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Organization>>>

  /**
   * Construct and simulate a get_transactions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns up to `limit` transactions, NEWEST FIRST, walking backwards
   * from `cursor`.
   * 
   * Pass `cursor = 0` to start from the most recent transaction. To page
   * further, pass the id of the last item you received, minus one.
   * 
   * `limit` is capped at `MAX_PAGE_LIMIT` because an unbounded read would
   * blow the network's per-transaction resource budget and simply fail --
   * better to reject it with a clear error the UI can act on.
   */
  get_transactions: ({cursor, limit}: {cursor: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Transaction>>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAMZDbG9zZXMgdGhlIGJvb2tzIHRvIG5ldyB3cml0ZXMuIFJlYWRzIGtlZXAgd29ya2luZyBmb3JldmVyLgoKSW50ZW5kZWQgZm9yIGVuZC1vZi10ZXJtIGhhbmRvdmVyOiB0aGUgb3V0Z29pbmcgdHJlYXN1cmVyIGZyZWV6ZXMgdGhlaXIKcmVjb3JkIHNvIG5vdGhpbmcgY2FuIGJlIGFwcGVuZGVkIHRvIHRoZWlyIHRlbnVyZSBhZnRlciB0aGUgZmFjdC4AAAAAAAdhcmNoaXZlAAAAAAAAAAABAAAD6QAAAAIAAAfQAAAADVRyZWFzdXJ5RXJyb3IAAAA=",
        "AAAAAAAAAQNCaW5kcyB0aGlzIGNvbnRyYWN0IGluc3RhbmNlIHRvIG9uZSBvcmdhbml6YXRpb24uIENhbGxhYmxlIGV4YWN0bHkgb25jZS4KClJlcXVpcmVzIHRoZSB0cmVhc3VyZXIncyBvd24gc2lnbmF0dXJlOiB0aGlzIHByb3ZlcyB0aGUgYWRkcmVzcyBpcyByZWFsCmFuZCBjb25zZW50cyB0byB0aGUgcm9sZSwgaW5zdGVhZCBvZiBsZXR0aW5nIGEgZGVwbG95ZXIgbm9taW5hdGUgYQp0eXBvJ2QgYWRkcmVzcyB0aGF0IGNhbiBuZXZlciByZWNvcmQgYW55dGhpbmcuAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAJdHJlYXN1cmVyAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAADFDdXJyZW50IGJhbGFuY2UgPT0gdG90YWwgaW5jb21lIC0gdG90YWwgZXhwZW5zZXMuAAAAAAAAC2dldF9iYWxhbmNlAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAALZ2V0X3N1bW1hcnkAAAAAAAAAAAEAAAfQAAAAB1N1bW1hcnkA",
        "AAAAAAAAADdSZWNvcmRzIG1vbmV5IHJlY2VpdmVkLiBSZXR1cm5zIHRoZSBuZXcgdHJhbnNhY3Rpb24gaWQuAAAAAA1yZWNvcmRfaW5jb21lAAAAAAAAAwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAADkluY29tZUNhdGVnb3J5AAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAEAAAPpAAAABAAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAADRSZWNvcmRzIG1vbmV5IHNwZW50LiBSZXR1cm5zIHRoZSBuZXcgdHJhbnNhY3Rpb24gaWQuAAAADnJlY29yZF9leHBlbnNlAAAAAAADAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAPRXhwZW5zZUNhdGVnb3J5AAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAQAAA+kAAAAEAAAH0AAAAA1UcmVhc3VyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAAPZ2V0X3RyYW5zYWN0aW9uAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAfQAAAAC1RyYW5zYWN0aW9uAAAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAQZ2V0X29yZ2FuaXphdGlvbgAAAAAAAAABAAAD6QAAB9AAAAAMT3JnYW5pemF0aW9uAAAH0AAAAA1UcmVhc3VyeUVycm9yAAAA",
        "AAAAAAAAAZ5SZXR1cm5zIHVwIHRvIGBsaW1pdGAgdHJhbnNhY3Rpb25zLCBORVdFU1QgRklSU1QsIHdhbGtpbmcgYmFja3dhcmRzCmZyb20gYGN1cnNvcmAuCgpQYXNzIGBjdXJzb3IgPSAwYCB0byBzdGFydCBmcm9tIHRoZSBtb3N0IHJlY2VudCB0cmFuc2FjdGlvbi4gVG8gcGFnZQpmdXJ0aGVyLCBwYXNzIHRoZSBpZCBvZiB0aGUgbGFzdCBpdGVtIHlvdSByZWNlaXZlZCwgbWludXMgb25lLgoKYGxpbWl0YCBpcyBjYXBwZWQgYXQgYE1BWF9QQUdFX0xJTUlUYCBiZWNhdXNlIGFuIHVuYm91bmRlZCByZWFkIHdvdWxkCmJsb3cgdGhlIG5ldHdvcmsncyBwZXItdHJhbnNhY3Rpb24gcmVzb3VyY2UgYnVkZ2V0IGFuZCBzaW1wbHkgZmFpbCAtLQpiZXR0ZXIgdG8gcmVqZWN0IGl0IHdpdGggYSBjbGVhciBlcnJvciB0aGUgVUkgY2FuIGFjdCBvbi4AAAAAABBnZXRfdHJhbnNhY3Rpb25zAAAAAgAAAAAAAAAGY3Vyc29yAAAAAAAEAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6QAAA+oAAAfQAAAAC1RyYW5zYWN0aW9uAAAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAABAAAAAAAAAAAAAAADVRyZWFzdXJ5RXJyb3IAAAAAAAAJAAAAR2Bpbml0aWFsaXplYCB3YXMgY2FsbGVkIG9uIGEgY29udHJhY3QgdGhhdCBhbHJlYWR5IGhhcyBhbiBvcmdhbml6YXRpb24uAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAlQW55IGNhbGwgYmVmb3JlIGBpbml0aWFsaXplYCBoYXMgcnVuLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAACNDYWxsZXIgaXMgbm90IHRoZSBzdG9yZWQgdHJlYXN1cmVyLgAAAAAMTm90VHJlYXN1cmVyAAAAAwAAAENBbW91bnQgd2FzIHplcm8gb3IgbmVnYXRpdmUuIE1vbmV5IG11c3QgbW92ZSBpbiBvbmUgZGlyZWN0aW9uIG9ubHkuAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABAAAAD1Pcmdhbml6YXRpb24gaXMgYXJjaGl2ZWQ7IHRoZSBib29rcyBhcmUgY2xvc2VkIHRvIG5ldyB3cml0ZXMuAAAAAAAAC09yZ0FyY2hpdmVkAAAAAAUAAAAoUmVxdWVzdGVkIHRyYW5zYWN0aW9uIGlkIGRvZXMgbm90IGV4aXN0LgAAAApUeE5vdEZvdW5kAAAAAAAGAAAAMlBhZ2luYXRpb24gYGxpbWl0YCB3YXMgemVybyBvciBhYm92ZSB0aGUgaGFyZCBjYXAuAAAAAAAMSW52YWxpZExpbWl0AAAABwAAADBEZXNjcmlwdGlvbiBleGNlZWRlZCB0aGUgb24tY2hhaW4gbGVuZ3RoIGJ1ZGdldC4AAAASRGVzY3JpcHRpb25Ub29Mb25nAAAAAAAIAAAAiEEgcnVubmluZyB0b3RhbCB3b3VsZCBoYXZlIGV4Y2VlZGVkIGkxMjguIFByYWN0aWNhbGx5IHVucmVhY2hhYmxlLCBidXQKZmFpbGluZyBsb3VkbHkgYmVhdHMgd3JpdGluZyBhIHdyYXBwZWQsIHBlcm1hbmVudGx5IHdyb25nIG51bWJlci4AAAAOQW1vdW50T3ZlcmZsb3cAAAAAAAk=",
        "AAAAAQAAAQxSdW5uaW5nIHRvdGFscywgbWFpbnRhaW5lZCBpbmNyZW1lbnRhbGx5IG9uIGV2ZXJ5IHdyaXRlLgoKVGhpcyBleGlzdHMgc28gdGhlIGRhc2hib2FyZCBpcyBhIHNpbmdsZSBPKDEpIHJlYWQgaW5zdGVhZCBvZiBhIHNjYW4gb3ZlcgpldmVyeSB0cmFuc2FjdGlvbiBldmVyIHJlY29yZGVkLiBgYmFsYW5jZWAgaXMgaW50ZW50aW9uYWxseSBOT1Qgc3RvcmVkIC0tCml0IGlzIGRlcml2ZWQsIGFuZCBzdG9yaW5nIGRlcml2ZWQgc3RhdGUgaXMgaG93IGxlZGdlcnMgZHJpZnQuAAAAAAAAAAdTdW1tYXJ5AAAAAAMAAAAAAAAADnRvdGFsX2V4cGVuc2VzAAAAAAALAAAAAAAAAAx0b3RhbF9pbmNvbWUAAAALAAAAAAAAAAh0eF9jb3VudAAAAAQ=",
        "AAAAAgAAAZdUaGUgZGlyZWN0aW9uIG9mIGEgdHJhbnNhY3Rpb24gKmFuZCogaXRzIGNhdGVnb3J5LCBhcyBhIHNpbmdsZSB2YWx1ZS4KCkRlbGliZXJhdGVseSBOT1QgdHdvIHNlcGFyYXRlIGZpZWxkcyAoYHR4X3R5cGVgICsgYGNhdGVnb3J5YCkuIFNwbGl0dGluZwp0aGVtIHdvdWxkIGFsbG93IGEgcmVjb3JkIHRoYXQgY2xhaW1zIHRvIGJlIEluY29tZSB3aGlsZSBjYXJyeWluZyB0aGUKYEZvb2RgIGNhdGVnb3J5IC0tIGEgc3RhdGUgdGhhdCBpcyBtZWFuaW5nbGVzcyBidXQgcmVwcmVzZW50YWJsZSwgYW5kCnRoZXJlZm9yZSBvbmUgdGhhdCBldmVudHVhbGx5IGdldHMgd3JpdHRlbiBieSBhY2NpZGVudCBhbmQgaXMgdGhlbgpwZXJtYW5lbnQuIEhlcmUgdGhhdCBzdGF0ZSBjYW5ub3QgYmUgY29uc3RydWN0ZWQgYXQgYWxsLgAAAAAAAAAACENhdGVnb3J5AAAAAgAAAAEAAAAAAAAABkluY29tZQAAAAAAAQAAB9AAAAAOSW5jb21lQ2F0ZWdvcnkAAAAAAAEAAAAAAAAAB0V4cGVuc2UAAAAAAQAAB9AAAAAPRXhwZW5zZUNhdGVnb3J5AA==",
        "AAAAAgAAALJMaWZlY3ljbGUgc3RhdGUgb2YgdGhlIG9yZ2FuaXphdGlvbi4KCmBBcmNoaXZlZGAgbGV0cyBhIGdyYWR1YXRpbmcgYmF0Y2ggZnJlZXplIHRoZSBib29rcyB3aXRob3V0IGRlbGV0aW5nCmhpc3RvcnkgLS0gbmV3IHdyaXRlcyBhcmUgcmVqZWN0ZWQsIGJ1dCBldmVyeSByZWFkIHN0aWxsIHdvcmtzIGZvcmV2ZXIuAAAAAAAAAAAACU9yZ1N0YXR1cwAAAAAAAAIAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAACEFyY2hpdmVk",
        "AAAAAQAAAQRBIHNpbmdsZSwgcGVybWFuZW50IGZpbmFuY2lhbCByZWNvcmQuCgpgYW1vdW50YCBpcyBhbHdheXMgUE9TSVRJVkUuIERpcmVjdGlvbiBpcyBjYXJyaWVkIGJ5IGBjYXRlZ29yeWAsIG5ldmVyIGJ5CnRoZSBzaWduIG9mIHRoZSBhbW91bnQgLS0gc2lnbmVkIGFtb3VudHMgaW52aXRlIGRvdWJsZS1uZWdhdGlvbiBidWdzIHdoZW4Kc3VtbWluZywgYW5kIGEgbmVnYXRpdmUgImluY29tZSIgd291bGQgYmUgbm9uc2Vuc2UgdGhhdCBjYW5ub3QgYmUgdW5kb25lLgAAAAAAAAALVHJhbnNhY3Rpb24AAAAABgAAADVNaW5vciB1bml0cyAoZS5nLiAxMjM0NTYgPT0gMSwyMzQuNTYpLiBOZXZlciBhIGZsb2F0LgAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAADZTZXF1ZW50aWFsLCBzdGFydGluZyBhdCAxLiBEb3VibGVzIGFzIHRoZSBzdG9yYWdlIGtleS4AAAAAAAJpZAAAAAAABAAAAEZUaGUgd2FsbGV0IHRoYXQgc2lnbmVkIHRoaXMgcmVjb3JkLiBUaGlzIGlzIHRoZSBhY2NvdW50YWJpbGl0eSBhbmNob3IuAAAAAAALcmVjb3JkZWRfYnkAAAAAEwAAAEJMZWRnZXIgY2xvc2UgdGltZSBpbiB1bml4IHNlY29uZHMgLS0gdGhlIGNsaWVudCBjYW5ub3QgZm9yZ2UgdGhpcy4AAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAANxUaGUgb3JnYW5pemF0aW9uIHRoaXMgY29udHJhY3QgaW5zdGFuY2UgYmVsb25ncyB0by4KClRoZXJlIGlzIGV4YWN0bHkgb25lIG9mIHRoZXNlIHBlciBkZXBsb3llZCBjb250cmFjdCwgc3RvcmVkIGluIGluc3RhbmNlCnN0b3JhZ2UuIFRoYXQgaXMgd2h5IHRoZXJlIGlzIG5vIGBvcmdfaWRgIGZpZWxkOiB0aGUgY29udHJhY3QgYWRkcmVzcwoqaXMqIHRoZSBvcmdhbml6YXRpb24gSUQuAAAAAAAAAAxPcmdhbml6YXRpb24AAAAEAAAARlVuaXggc2Vjb25kcywgdGFrZW4gZnJvbSB0aGUgbGVkZ2VyIGNsb3NlIHRpbWUgLS0gbm90IGZyb20gdGhlIGNsaWVudC4AAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAACU9yZ1N0YXR1cwAAAAAAADJUaGUgb25seSBhZGRyZXNzIHBlcm1pdHRlZCB0byByZWNvcmQgdHJhbnNhY3Rpb25zLgAAAAAACXRyZWFzdXJlcgAAAAAAABM=",
        "AAAAAgAAABZXaGVyZSBtb25leSBjYW1lIGZyb20uAAAAAAAAAAAADkluY29tZUNhdGVnb3J5AAAAAAAGAAAAAAAAAAAAAAANTWVtYmVyc2hpcEZlZQAAAAAAAAAAAAAAAAAACERvbmF0aW9uAAAAAAAAAAAAAAALU3BvbnNvcnNoaXAAAAAAAAAAAAAAAAALTWVyY2hhbmRpc2UAAAAAAAAAAAAAAAARRXZlbnRSZWdpc3RyYXRpb24AAAAAAAAAAAAAAAAAAAVPdGhlcgAAAA==",
        "AAAAAgAAABFXaGVyZSBtb25leSB3ZW50LgAAAAAAAAAAAAAPRXhwZW5zZUNhdGVnb3J5AAAAAAgAAAAAAAAAAAAAAARGb29kAAAAAAAAAAAAAAAFVmVudWUAAAAAAAAAAAAAAAAAAAlFcXVpcG1lbnQAAAAAAAAAAAAAAAAAAA5UcmFuc3BvcnRhdGlvbgAAAAAAAAAAAAAAAAAJTWFya2V0aW5nAAAAAAAAAAAAAAAAAAAIU3VwcGxpZXMAAAAAAAAAAAAAAAhQcmludGluZwAAAAAAAAAAAAAABU90aGVyAAAA",
        "AAAABQAAAAAAAAAAAAAAE09yZ2FuaXphdGlvbkNyZWF0ZWQAAAAAAQAAABRvcmdhbml6YXRpb25fY3JlYXRlZAAAAAMAAAAAAAAACXRyZWFzdXJlcgAAAAAAABMAAAABAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAMpFbWl0dGVkIGZvciBldmVyeSBpbmNvbWUgYW5kIGV4cGVuc2UuCgpgcmVjb3JkZWRfYnlgIGlzIGEgdG9waWMgc28gYSBtZW1iZXIgY2FuIGZpbHRlciB0aGUgd2hvbGUgY2hhaW4gZm9yCiJldmVyeXRoaW5nIHRoaXMgdHJlYXN1cmVyIGV2ZXIgcmVjb3JkZWQiIC0tIHRoZSBhdWRpdCB0cmFpbCB0aGF0IHN1cnZpdmVzCmxlYWRlcnNoaXAgaGFuZG92ZXIuAAAAAAAAAAAAE1RyYW5zYWN0aW9uUmVjb3JkZWQAAAAAAQAAABR0cmFuc2FjdGlvbl9yZWNvcmRlZAAAAAUAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAAAAAALcmVjb3JkZWRfYnkAAAAAEwAAAAEAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAFE9yZ2FuaXphdGlvbkFyY2hpdmVkAAAAAQAAABVvcmdhbml6YXRpb25fYXJjaGl2ZWQAAAAAAAACAAAAAAAAAAl0cmVhc3VyZXIAAAAAAAATAAAAAQAAAAAAAAALYXJjaGl2ZWRfYXQAAAAABgAAAAAAAAAC",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAqVGhlIG9yZ2FuaXphdGlvbiByZWNvcmQuIEluc3RhbmNlIHN0b3JhZ2UuAAAAAAADT3JnAAAAAAAAAAAhUnVubmluZyB0b3RhbHMuIEluc3RhbmNlIHN0b3JhZ2UuAAAAAAAAB1N1bW1hcnkAAAAAAQAAACtPbmUgdHJhbnNhY3Rpb24sIGJ5IGlkLiBQZXJzaXN0ZW50IHN0b3JhZ2UuAAAAAAJUeAAAAAAAAQAAAAQ=" ]),
      options
    )
  }
  public readonly fromJSON = {
    archive: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        get_balance: this.txFromJSON<i128>,
        get_summary: this.txFromJSON<Summary>,
        record_income: this.txFromJSON<Result<u32>>,
        record_expense: this.txFromJSON<Result<u32>>,
        get_transaction: this.txFromJSON<Result<Transaction>>,
        get_organization: this.txFromJSON<Result<Organization>>,
        get_transactions: this.txFromJSON<Result<Array<Transaction>>>
  }
}