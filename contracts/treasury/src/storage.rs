//! Storage keys, TTL policy, and typed accessors.
//!
//! No other module should touch `env.storage()` directly. Centralising it here
//! means the TTL rules below cannot be forgotten at a call site -- and a
//! forgotten TTL bump is a contract that silently stops working weeks after
//! the demo.

use soroban_sdk::{contracttype, Env};

use crate::error::TreasuryError;
use crate::types::{Organization, Summary, Transaction};

/// Ledgers close roughly every 5 seconds on Stellar => ~17,280 per day.
pub(crate) const DAY_IN_LEDGERS: u32 = 17_280;

/// How far ahead we push expiry when we bump.
pub(crate) const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;

/// Only bump when remaining life drops below this, so we do not pay rent on
/// every single call.
pub(crate) const BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS;

/// Hard cap on a single `get_transactions` page.
///
/// Exists to keep any one read inside the network's resource limits. Without
/// it a member could request 10,000 rows and the call would simply fail.
pub const MAX_PAGE_LIMIT: u32 = 50;

/// Max description length in bytes. Descriptions are permanent and paid for
/// by ledger rent; this keeps a single record from becoming an essay.
pub const MAX_DESCRIPTION_LEN: u32 = 200;

#[contracttype]
pub enum DataKey {
    /// The organization record. Instance storage.
    Org,
    /// Running totals. Instance storage.
    Summary,
    /// One transaction, by id. Persistent storage.
    Tx(u32),
}

// ---------------------------------------------------------------------------
// Instance storage
//
// Instance storage shares one TTL with the contract itself: bump it and the
// whole instance (org + summary + contract code) stays alive together. That is
// exactly the coupling we want for small, always-read, always-current data.
// ---------------------------------------------------------------------------

pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

pub fn has_org(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Org)
}

pub fn set_org(env: &Env, org: &Organization) {
    env.storage().instance().set(&DataKey::Org, org);
}

pub fn get_org(env: &Env) -> Result<Organization, TreasuryError> {
    env.storage()
        .instance()
        .get(&DataKey::Org)
        .ok_or(TreasuryError::NotInitialized)
}

pub fn set_summary(env: &Env, summary: &Summary) {
    env.storage().instance().set(&DataKey::Summary, summary);
}

/// Returns zeroed totals rather than an error when absent, so `get_summary`
/// on a freshly initialized org renders an empty dashboard instead of failing.
pub fn get_summary(env: &Env) -> Summary {
    env.storage()
        .instance()
        .get(&DataKey::Summary)
        .unwrap_or(Summary {
            total_income: 0,
            total_expenses: 0,
            tx_count: 0,
        })
}

// ---------------------------------------------------------------------------
// Persistent storage
//
// Each transaction gets its own entry. This is the whole reason the contract
// scales: writing record #900 costs the same as writing record #1, and reading
// one record never deserializes the other 899.
// ---------------------------------------------------------------------------

pub fn set_tx(env: &Env, tx: &Transaction) {
    let key = DataKey::Tx(tx.id);
    env.storage().persistent().set(&key, tx);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

/// Reads a transaction and refreshes its TTL.
///
/// Bumping on read is intentional: records people actually look at stay alive.
/// Note this makes reads state-changing at the ledger level, which is fine --
/// simulated (read-only) calls simply discard the bump.
pub fn get_tx(env: &Env, id: u32) -> Option<Transaction> {
    let key = DataKey::Tx(id);
    let tx: Option<Transaction> = env.storage().persistent().get(&key);
    if tx.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
    tx
}
