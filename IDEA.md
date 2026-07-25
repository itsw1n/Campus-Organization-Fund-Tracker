# Campus Organization Fund Tracker

## Idea
- **Track:** Student Organization / Social Impact
- **Idea # :**
- **One-liner:** A blockchain-powered treasury management platform that lets school organizations track income and expenses transparently on Stellar.

## Problem
School organizations collect funds from fees, donations, sponsorships, and events — but manage them through spreadsheets. Members can't easily verify spending, reports are delayed, records get lost during leadership transitions, and trust erodes.

## How it uses Stellar
- **Soroban smart contracts** to store financial records (income, expenses, timestamps, categories) immutably on-chain
- **Freighter wallet** for authentication and transaction signing
- **Stellar testnet** for demo and development
- Each transaction is a signed on-chain record — publicly verifiable by anyone

## What works in the demo
- [ ] Connect wallet (Freighter, testnet)
- [ ] Core flow runs end-to-end on testnet
- [ ] Record income and expenses on-chain
- [ ] View dashboard with balance, summary, and transaction history

## Setup / run
- Network: **testnet**
- `cd web && npm install && npm run dev`
- Contract (if used): `./scripts/deploy.sh` or `.\scripts\deploy.ps1`, then set `NEXT_PUBLIC_CONTRACT_ID`
- No other env vars needed for basic payments demo

## Demo
- 2–4 min video link (show the core flow working on testnet):
- Public repo link:

## Submission checklist
- [ ] Public GitHub repo with a license (MIT)
- [ ] README explains problem, Stellar usage, and setup
- [ ] Demo video (2–4 min)
- [ ] Submitted via the workshop's official GitHub issue template
