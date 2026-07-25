#![no_std]
//! TreasuryChain -- transparent treasury records for student organizations.
//!
//! One deployed instance == one organization.
//!
//! This contract is a LEDGER, not a VAULT. It records that money moved in the
//! real world; it does not custody any asset. The guarantee it provides is
//! that once a record exists, nobody -- including the treasurer -- can alter
//! or delete it. There is deliberately no `update_transaction` and no
//! `delete_transaction`. Corrections are made by recording a compensating
//! entry, exactly as in double-entry bookkeeping.

mod error;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use error::TreasuryError;
pub use types::{
    Category, ExpenseCategory, IncomeCategory, OrgStatus, Organization, Summary, Transaction,
};

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

use events::{OrganizationArchived, OrganizationCreated, TransactionRecorded};
use storage::{MAX_DESCRIPTION_LEN, MAX_PAGE_LIMIT};

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    // -----------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------

    /// Binds this contract instance to one organization. Callable exactly once.
    ///
    /// Requires the treasurer's own signature: this proves the address is real
    /// and consents to the role, instead of letting a deployer nominate a
    /// typo'd address that can never record anything.
    pub fn initialize(
        env: Env,
        name: String,
        treasurer: Address,
    ) -> Result<(), TreasuryError> {
        if storage::has_org(&env) {
            return Err(TreasuryError::AlreadyInitialized);
        }
        treasurer.require_auth();

        let created_at = env.ledger().timestamp();
        let org = Organization {
            name: name.clone(),
            treasurer: treasurer.clone(),
            created_at,
            status: OrgStatus::Active,
        };

        storage::set_org(&env, &org);
        storage::set_summary(
            &env,
            &Summary {
                total_income: 0,
                total_expenses: 0,
                tx_count: 0,
            },
        );
        storage::bump_instance(&env);

        OrganizationCreated {
            treasurer,
            name,
            created_at,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------
    // Writes (treasurer only)
    // -----------------------------------------------------------------

    /// Records money received. Returns the new transaction id.
    pub fn record_income(
        env: Env,
        category: IncomeCategory,
        amount: i128,
        description: String,
    ) -> Result<u32, TreasuryError> {
        Self::record(env, Category::Income(category), amount, description)
    }

    /// Records money spent. Returns the new transaction id.
    pub fn record_expense(
        env: Env,
        category: ExpenseCategory,
        amount: i128,
        description: String,
    ) -> Result<u32, TreasuryError> {
        Self::record(env, Category::Expense(category), amount, description)
    }

    /// Closes the books to new writes. Reads keep working forever.
    ///
    /// Intended for end-of-term handover: the outgoing treasurer freezes their
    /// record so nothing can be appended to their tenure after the fact.
    pub fn archive(env: Env) -> Result<(), TreasuryError> {
        let mut org = storage::get_org(&env)?;
        Self::require_treasurer(&org)?;

        if org.status == OrgStatus::Archived {
            return Err(TreasuryError::OrgArchived);
        }

        org.status = OrgStatus::Archived;
        storage::set_org(&env, &org);
        storage::bump_instance(&env);

        OrganizationArchived {
            treasurer: org.treasurer,
            archived_at: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------
    // Reads (public, no wallet required)
    //
    // These are served via `simulateTransaction` from the frontend: no
    // signature, no fee, no ledger write. Any member -- or anyone at all --
    // can audit this organization without an account.
    // -----------------------------------------------------------------

    pub fn get_organization(env: Env) -> Result<Organization, TreasuryError> {
        storage::get_org(&env)
    }

    pub fn get_summary(env: Env) -> Summary {
        storage::get_summary(&env)
    }

    /// Current balance == total income - total expenses.
    pub fn get_balance(env: Env) -> i128 {
        storage::get_summary(&env).balance()
    }

    pub fn get_transaction(env: Env, id: u32) -> Result<Transaction, TreasuryError> {
        storage::get_tx(&env, id).ok_or(TreasuryError::TxNotFound)
    }

    /// Returns up to `limit` transactions, NEWEST FIRST, walking backwards
    /// from `cursor`.
    ///
    /// Pass `cursor = 0` to start from the most recent transaction. To page
    /// further, pass the id of the last item you received, minus one.
    ///
    /// `limit` is capped at `MAX_PAGE_LIMIT` because an unbounded read would
    /// blow the network's per-transaction resource budget and simply fail --
    /// better to reject it with a clear error the UI can act on.
    pub fn get_transactions(
        env: Env,
        cursor: u32,
        limit: u32,
    ) -> Result<Vec<Transaction>, TreasuryError> {
        if limit == 0 || limit > MAX_PAGE_LIMIT {
            return Err(TreasuryError::InvalidLimit);
        }

        let tx_count = storage::get_summary(&env).tx_count;
        let mut results = Vec::new(&env);

        if tx_count == 0 {
            return Ok(results);
        }

        // Ids are dense (1..=tx_count) because records can never be deleted,
        // so we can walk the range directly with no index to maintain.
        let start = if cursor == 0 || cursor > tx_count {
            tx_count
        } else {
            cursor
        };

        let mut id = start;
        while id >= 1 && results.len() < limit {
            if let Some(tx) = storage::get_tx(&env, id) {
                results.push_back(tx);
            }
            id -= 1;
        }

        Ok(results)
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /// Single write path for both income and expense.
    ///
    /// Both public recorders funnel through here so validation, auth, id
    /// assignment, total updates and TTL bumping cannot drift apart between
    /// the two.
    fn record(
        env: Env,
        category: Category,
        amount: i128,
        description: String,
    ) -> Result<u32, TreasuryError> {
        let org = storage::get_org(&env)?;

        if org.status == OrgStatus::Archived {
            return Err(TreasuryError::OrgArchived);
        }
        Self::require_treasurer(&org)?;

        // Amounts are always positive; direction is carried by `category`.
        if amount <= 0 {
            return Err(TreasuryError::InvalidAmount);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            return Err(TreasuryError::DescriptionTooLong);
        }

        let mut summary = storage::get_summary(&env);

        // checked_* rather than a bare `+`: a wrapped total would be a wrong
        // number written permanently, which is worse than a failed call.
        if category.is_income() {
            summary.total_income = summary
                .total_income
                .checked_add(amount)
                .ok_or(TreasuryError::AmountOverflow)?;
        } else {
            summary.total_expenses = summary
                .total_expenses
                .checked_add(amount)
                .ok_or(TreasuryError::AmountOverflow)?;
        }

        let id = summary
            .tx_count
            .checked_add(1)
            .ok_or(TreasuryError::AmountOverflow)?;
        summary.tx_count = id;

        let tx = Transaction {
            id,
            category,
            amount,
            description,
            // Ledger close time, not a client-supplied value. A treasurer
            // cannot backdate a record.
            timestamp: env.ledger().timestamp(),
            recorded_by: org.treasurer.clone(),
        };

        storage::set_tx(&env, &tx);
        storage::set_summary(&env, &summary);
        storage::bump_instance(&env);

        TransactionRecorded {
            id,
            recorded_by: org.treasurer,
            category,
            amount,
            timestamp: tx.timestamp,
        }
        .publish(&env);

        Ok(id)
    }

    /// The entire MVP permission model: one privileged address, everyone else
    /// reads. Officer roles and multisig approval are deliberately deferred.
    fn require_treasurer(org: &Organization) -> Result<(), TreasuryError> {
        org.treasurer.require_auth();
        Ok(())
    }
}
