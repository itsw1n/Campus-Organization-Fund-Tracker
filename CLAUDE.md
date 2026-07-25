# Campus Organization Fund Tracker — project notes for AI tools

An append-only treasury ledger for school organizations, on Soroban. Two parts:

- `frontend/` — Next.js 16 + React 19 + TypeScript + Tailwind v4.
- `contracts/treasury/` — the Rust Soroban contract, with unit tests.

## The one thing to understand first

This is a **ledger, not a vault**. The contract records that money moved in the
real world; it never custodies any asset. The guarantee it offers is that once a
record exists, nobody — including the treasurer — can alter or delete it. There
is deliberately no `update_*` and no `delete_*`: corrections are made by
recording an offsetting entry, as in double-entry bookkeeping.

One deployed contract instance == one organization. The contract address *is*
the organization ID, which is why no entity carries an `org_id`.

## Stack / versions

- `soroban-sdk` 27.0.2; build target `wasm32v1-none` via `stellar contract build`
  (never `cargo build` — it omits the contract spec).
- `@stellar/stellar-sdk` v16 — use the `rpc` namespace (NOT the old `SorobanRpc`).
- `@stellar/freighter-api` v6.
- Network: **testnet** only.

## Gotchas that actually bite (learned the hard way)

1. **Freighter never throws.** Every function resolves `{ ...data, error? }`. A
   `try/catch` alone silently swallows rejected prompts. See
   `frontend/src/services/freighter.ts`, which normalises this into a result
   type the caller cannot ignore.
2. **`isConnected()` means "extension installed"**, not "site authorized".
   Site authorization is `isAllowed()`.
3. **Reads need no wallet.** They run as simulations, which is what makes the
   treasury publicly auditable. Only writes touch Freighter.
4. **Keep `client-only` code out of the server graph.** Reads live in
   `services/treasury.ts` (server-safe); signing lives in
   `services/treasury-write.ts`. Merging them breaks the build, because the
   dashboard and history are React Server Components.
5. **Money is `bigint` end to end.** `i128` maps to `bigint`, requiring an
   ES2020+ tsconfig target. Amounts are integer minor units; parsing is
   string-based because `parseFloat("19.99") * 100` is `1998.9999999999998`.
6. **Descriptions are limited in BYTES, not characters** — the contract checks
   Soroban `String::len()`. Validate with `TextEncoder`, or emoji pass the form
   and get rejected on-chain after the user has already signed.
7. **A Rust `Err` return escalates to a failed invocation.** Prefer inspecting
   `result.isErr()` over calling `unwrap()` and catching the throw.
8. **Persistent entries expire.** TTL is bumped on every read and write; all
   storage access is centralised in `storage.rs` so a bump cannot be forgotten.
9. **Generated bindings are committed.** CI has no Stellar CLI. Regenerate with
   `scripts/deploy.ps1` / `.sh`, which copies only the generated source — the
   emitted npm package pins an older SDK and would load a second copy.
10. `initialize` requires the **treasurer's own signature**, so it cannot run
    from a deploy script. It is done once from `/dashboard` in the browser.

## Testnet reference

| Resource | Value |
|---|---|
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Friendbot | `https://friendbot.stellar.org?addr=YOUR_KEY` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |

## Where things live

- Contract entrypoints: `contracts/treasury/src/lib.rs`
- Data model: `types.rs` · storage + TTL: `storage.rs` · errors: `error.rs`
- Contract tests: `contracts/treasury/src/test.rs`
- Reads (server-safe): `frontend/src/services/treasury.ts`
- Writes (client-only): `frontend/src/services/treasury-write.ts`
- Wallet: `frontend/src/services/freighter.ts`, `contexts/WalletContext.tsx`
- Generated client: `frontend/src/contracts/treasury.ts` (do not hand-edit)
- Deploy: `scripts/deploy.ps1` (Windows) / `scripts/deploy.sh`
