# Deploy the treasury contract to Stellar testnet, regenerate the TypeScript
# bindings, and write the contract ID into frontend\.env.local.
#
# Prereqs: Rust + the wasm32v1-none target, and the Stellar CLI
# (run `stellar --version` to confirm).
#
# Usage:  .\scripts\deploy.ps1 [identityName]   (default identity: deployer)
#
# NOTE: this script deliberately does NOT initialise the organisation.
# `initialize` requires the treasurer's own signature, which lives in their
# Freighter wallet -- so it is done once from the app's /dashboard page after
# deploying. The deploy identity has no authority over the treasury.

param([string]$Identity = "deployer")

$ErrorActionPreference = "Stop"
$Network = "testnet"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Wasm = "target\wasm32v1-none\release\treasury.wasm"
$EnvFile = Join-Path $Root "frontend\.env.local"
$BindingsTmp = Join-Path $env:TEMP "treasury-bindings"

Set-Location $Root

# 1. Ensure a funded testnet identity exists
$keys = stellar keys ls
if ($keys -notcontains $Identity) {
  Write-Host "Creating + funding testnet identity '$Identity'..."
  stellar keys generate $Identity --network $Network --fund
}

# 2. Build the contract to wasm. Never `cargo build` -- that skips the
#    contract spec that the CLI and the bindings generator depend on.
Write-Host "Building contract..."
stellar contract build

# 3. Deploy to testnet (returns the contract ID, starting with C...)
Write-Host "Deploying to $Network..."
$ContractId = (stellar contract deploy --wasm $Wasm --source-account $Identity --network $Network --alias treasury).Trim()
Write-Host "Deployed contract ID: $ContractId"

# 4. Regenerate the typed client from the deployed contract.
#    The CLI emits a whole npm package, but it pins an older @stellar/stellar-sdk
#    than the app uses. Installing it would load two copies of the SDK and break
#    instanceof checks, so take only the generated source and let it resolve
#    against the app's own SDK.
Write-Host "Generating TypeScript bindings..."
if (Test-Path $BindingsTmp) { Remove-Item -Recurse -Force $BindingsTmp }
stellar contract bindings typescript --contract-id $ContractId --network $Network --output-dir $BindingsTmp
Copy-Item (Join-Path $BindingsTmp "src\index.ts") (Join-Path $Root "frontend\src\contracts\treasury.ts") -Force
Remove-Item -Recurse -Force $BindingsTmp

# 5. Write NEXT_PUBLIC_CONTRACT_ID into frontend\.env.local
if (Test-Path $EnvFile) {
  (Get-Content $EnvFile) | Where-Object { $_ -notmatch '^NEXT_PUBLIC_CONTRACT_ID=' } | Set-Content $EnvFile
}
Add-Content $EnvFile "NEXT_PUBLIC_CONTRACT_ID=$ContractId"

Write-Host ""
Write-Host "Wrote NEXT_PUBLIC_CONTRACT_ID=$ContractId to frontend\.env.local"
Write-Host "Next: restart 'npm run dev', open /dashboard, connect the treasurer's"
Write-Host "wallet, and create the organisation. That step signs with the"
Write-Host "treasurer's key and can only be done once."
