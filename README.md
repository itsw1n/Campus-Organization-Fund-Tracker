# Campus Organization Fund Tracker

A transparent blockchain-powered treasury management platform for student organizations.

## Problem

Student organizations collect funds from membership fees, event registrations, sponsorships, donations, and merchandise sales — but financial management relies on spreadsheets or manual bookkeeping. Members cannot easily verify how funds are spent, financial reports are delayed or unavailable, historical records may be modified or lost, and leadership transitions make auditing difficult. This reduces trust between officers and members.

In the Philippines, student organizations in universities like PUP manage significant funds with little to no financial transparency. This project brings blockchain-verified accountability to school organizations.

## How It Works

1. A treasurer connects their Freighter wallet and records income (membership fees, donations, sponsorships) or expenses (food, venue, equipment, supplies).
2. Each transaction is signed and recorded as a Soroban smart contract entry on Stellar testnet.
3. Organization members can open the dashboard to view the current balance, financial summary, and complete transaction history — all independently verifiable on-chain.
4. No manual reports needed — the blockchain is the source of truth.

## How It Uses Stellar

Every financial transaction is recorded through **Soroban smart contracts**, creating an immutable and publicly verifiable audit trail. The smart contract stores income records, expense records, timestamps, categories, descriptions, and the treasurer's wallet address on-chain.

Stellar was chosen because of its low transaction fees, fast settlement, built-in decentralized exchange, and the Soroban smart contract platform that makes it easy to build transparent financial ledgers without the complexity and cost of other L1s.

Specific Stellar features used:
- **Soroban smart contracts** for financial record storage and retrieval
- **Freighter wallet** for transaction signing and user authentication
- **Stellar testnet** for development and demonstration
- **Friendbot** for testnet account funding
- **Stellar expert / block explorer** for on-chain verification

## Track

StellarX Philippines — Student Organization Track

## Tech Stack

- Framework: Next.js 16 + TypeScript + Tailwind CSS
- Stellar SDK: @stellar/stellar-sdk v16
- Smart Contracts: Rust + soroban-sdk
- Network: testnet
- Wallet: Freighter
- Key deps: TanStack Query, React Hook Form, Zod

## Setup & Run

```bash
git clone https://github.com/itsw1n/Campus-Organization-Fund-Tracker.git
cd Campus-Organization-Fund-Tracker/web
npm install
npm run dev
```

No environment variables needed for basic payments demo — `web/.env.local` is pre-configured for testnet. For the Soroban contract panel, deploy the contract and set `NEXT_PUBLIC_CONTRACT_ID`.

## Network Details

- Network: testnet
- RPC URL: https://soroban-testnet.stellar.org
- Contract IDs: Set after deploying `contracts/savings-goal`
- Asset issuers: N/A (uses testnet XLM and USDC SAC)

## Team

- [Your Name] — @[your-github-username]

## License

MIT
