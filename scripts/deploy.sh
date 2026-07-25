#!/usr/bin/env bash
# Deploy the treasury contract to Stellar testnet, regenerate the TypeScript
# bindings, and write the contract ID into frontend/.env.local.
#
# Prereqs: Rust + the wasm32v1-none target, and the Stellar CLI
# (run `stellar --version` to confirm).
#
# Usage:  ./scripts/deploy.sh [identityName]   (default identity: deployer)
#
# NOTE: this script deliberately does NOT initialise the organisation.
# `initialize` requires the treasurer's own signature, which lives in their
# Freighter wallet -- so it is done once from the app's /dashboard page after
# deploying. The deploy identity has no authority over the treasury.
set -euo pipefail

IDENTITY="${1:-deployer}"
NETWORK="testnet"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="target/wasm32v1-none/release/treasury.wasm"
ENV_FILE="$ROOT/frontend/.env.local"
BINDINGS_TMP="$(mktemp -d)"

cd "$ROOT"

# 1. Ensure a funded testnet identity exists
if ! stellar keys ls | grep -qx "$IDENTITY"; then
  echo "Creating + funding testnet identity '$IDENTITY'..."
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi

# 2. Build the contract to wasm. Never `cargo build` -- that skips the
#    contract spec that the CLI and the bindings generator depend on.
echo "Building contract..."
stellar contract build

# 3. Deploy to testnet (returns the contract ID, starting with C...)
echo "Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  --alias treasury)
echo "Deployed contract ID: $CONTRACT_ID"

# 4. Regenerate the typed client from the deployed contract.
#    The CLI emits a whole npm package, but it pins an older @stellar/stellar-sdk
#    than the app uses. Installing it would load two copies of the SDK and break
#    instanceof checks, so take only the generated source and let it resolve
#    against the app's own SDK.
echo "Generating TypeScript bindings..."
stellar contract bindings typescript \
  --contract-id "$CONTRACT_ID" \
  --network "$NETWORK" \
  --output-dir "$BINDINGS_TMP/treasury-client"
cp "$BINDINGS_TMP/treasury-client/src/index.ts" "$ROOT/frontend/src/contracts/treasury.ts"
rm -rf "$BINDINGS_TMP"

# 5. Write NEXT_PUBLIC_CONTRACT_ID into frontend/.env.local
if [ -f "$ENV_FILE" ]; then
  grep -v '^NEXT_PUBLIC_CONTRACT_ID=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
fi
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" >> "$ENV_FILE"

echo ""
echo "Wrote NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID to frontend/.env.local"
echo "Next: restart 'npm run dev', open /dashboard, connect the treasurer's"
echo "wallet, and create the organisation. That step signs with the"
echo "treasurer's key and can only be done once."
