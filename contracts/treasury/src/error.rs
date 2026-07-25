//! Typed contract errors.
//!
//! These surface to the frontend as structured error codes instead of an
//! opaque "transaction failed", which is the difference between a usable app
//! and a demo that dies on stage.
//!
//! Discriminants are part of the public API: never renumber an existing
//! variant, only append new ones.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TreasuryError {
    /// `initialize` was called on a contract that already has an organization.
    AlreadyInitialized = 1,
    /// Any call before `initialize` has run.
    NotInitialized = 2,
    /// Caller is not the stored treasurer.
    NotTreasurer = 3,
    /// Amount was zero or negative. Money must move in one direction only.
    InvalidAmount = 4,
    /// Organization is archived; the books are closed to new writes.
    OrgArchived = 5,
    /// Requested transaction id does not exist.
    TxNotFound = 6,
    /// Pagination `limit` was zero or above the hard cap.
    InvalidLimit = 7,
    /// Description exceeded the on-chain length budget.
    DescriptionTooLong = 8,
    /// A running total would have exceeded i128. Practically unreachable, but
    /// failing loudly beats writing a wrapped, permanently wrong number.
    AmountOverflow = 9,
}
