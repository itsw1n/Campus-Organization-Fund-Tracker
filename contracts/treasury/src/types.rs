//! On-chain data model for TreasuryChain.
//!
//! Design rule: everything in this file is *immutable financial record*.
//! Anything cosmetic (logos, member emails, receipt images, announcements)
//! belongs off-chain and must never appear here.

use soroban_sdk::{contracttype, Address, String};

/// Lifecycle state of the organization.
///
/// `Archived` lets a graduating batch freeze the books without deleting
/// history -- new writes are rejected, but every read still works forever.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OrgStatus {
    Active,
    Archived,
}

/// The organization this contract instance belongs to.
///
/// There is exactly one of these per deployed contract, stored in instance
/// storage. That is why there is no `org_id` field: the contract address
/// *is* the organization ID.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Organization {
    pub name: String,
    /// The only address permitted to record transactions.
    pub treasurer: Address,
    /// Unix seconds, taken from the ledger close time -- not from the client.
    pub created_at: u64,
    pub status: OrgStatus,
}

/// Where money came from.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IncomeCategory {
    MembershipFee,
    Donation,
    Sponsorship,
    Merchandise,
    EventRegistration,
    Other,
}

/// Where money went.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExpenseCategory {
    Food,
    Venue,
    Equipment,
    Transportation,
    Marketing,
    Supplies,
    Printing,
    Other,
}

/// The direction of a transaction *and* its category, as a single value.
///
/// Deliberately NOT two separate fields (`tx_type` + `category`). Splitting
/// them would allow a record that claims to be Income while carrying the
/// `Food` category -- a state that is meaningless but representable, and
/// therefore one that eventually gets written by accident and is then
/// permanent. Here that state cannot be constructed at all.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Category {
    Income(IncomeCategory),
    Expense(ExpenseCategory),
}

impl Category {
    pub fn is_income(&self) -> bool {
        matches!(self, Category::Income(_))
    }
}

/// A single, permanent financial record.
///
/// `amount` is always POSITIVE. Direction is carried by `category`, never by
/// the sign of the amount -- signed amounts invite double-negation bugs when
/// summing, and a negative "income" would be nonsense that cannot be undone.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transaction {
    /// Sequential, starting at 1. Doubles as the storage key.
    pub id: u32,
    pub category: Category,
    /// Minor units (e.g. 123456 == 1,234.56). Never a float.
    pub amount: i128,
    pub description: String,
    /// Ledger close time in unix seconds -- the client cannot forge this.
    pub timestamp: u64,
    /// The wallet that signed this record. This is the accountability anchor.
    pub recorded_by: Address,
}

/// Running totals, maintained incrementally on every write.
///
/// This exists so the dashboard is a single O(1) read instead of a scan over
/// every transaction ever recorded. `balance` is intentionally NOT stored --
/// it is derived, and storing derived state is how ledgers drift.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Summary {
    pub total_income: i128,
    pub total_expenses: i128,
    pub tx_count: u32,
}

impl Summary {
    pub fn balance(&self) -> i128 {
        self.total_income - self.total_expenses
    }
}
