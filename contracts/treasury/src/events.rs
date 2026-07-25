//! Contract events.
//!
//! Events are how the outside world watches this treasury without polling
//! every storage key: block explorers, indexers and future notification
//! features subscribe to them. They are emitted in addition to storage, never
//! instead of it -- events are not queryable contract state.
//!
//! Fields marked `#[topic]` are indexed and can be filtered on; everything
//! else rides along as event data.

use soroban_sdk::{contractevent, Address, String};

use crate::types::Category;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrganizationCreated {
    #[topic]
    pub treasurer: Address,
    pub name: String,
    pub created_at: u64,
}

/// Emitted for every income and expense.
///
/// `recorded_by` is a topic so a member can filter the whole chain for
/// "everything this treasurer ever recorded" -- the audit trail that survives
/// leadership handover.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionRecorded {
    #[topic]
    pub id: u32,
    #[topic]
    pub recorded_by: Address,
    pub category: Category,
    pub amount: i128,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrganizationArchived {
    #[topic]
    pub treasurer: Address,
    pub archived_at: u64,
}
