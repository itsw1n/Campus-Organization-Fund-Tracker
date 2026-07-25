#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String,
};

use crate::storage::MAX_PAGE_LIMIT;
use crate::{
    ExpenseCategory, IncomeCategory, OrgStatus, TreasuryContract, TreasuryContractClient,
    TreasuryError,
};

/// Registers the contract and initializes it with a generated treasurer.
///
/// Auth is mocked here so the happy-path tests stay readable; the tests that
/// actually care about authorization build their own env without mocks.
fn setup<'a>() -> (Env, TreasuryContractClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TreasuryContract, ());
    let client = TreasuryContractClient::new(&env, &contract_id);
    let treasurer = Address::generate(&env);

    client.initialize(&String::from_str(&env, "CS Society"), &treasurer);

    (env, client, treasurer)
}

fn desc<'a>(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

#[test]
fn initialize_stores_the_organization() {
    let (env, client, treasurer) = setup();

    let org = client.get_organization();
    assert_eq!(org.name, String::from_str(&env, "CS Society"));
    assert_eq!(org.treasurer, treasurer);
    assert_eq!(org.status, OrgStatus::Active);
}

#[test]
fn initialize_starts_with_an_empty_summary() {
    let (_env, client, _) = setup();

    let summary = client.get_summary();
    assert_eq!(summary.total_income, 0);
    assert_eq!(summary.total_expenses, 0);
    assert_eq!(summary.tx_count, 0);
    assert_eq!(client.get_balance(), 0);
}

#[test]
fn initialize_is_rejected_the_second_time() {
    let (env, client, _) = setup();
    let other = Address::generate(&env);

    assert_eq!(
        client.try_initialize(&desc(&env, "Impostor Org"), &other),
        Err(Ok(TreasuryError::AlreadyInitialized))
    );
}

#[test]
fn calls_before_initialize_report_not_initialized() {
    let env = Env::default();
    let contract_id = env.register(TreasuryContract, ());
    let client = TreasuryContractClient::new(&env, &contract_id);

    assert_eq!(
        client.try_get_organization(),
        Err(Ok(TreasuryError::NotInitialized))
    );
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

#[test]
fn recording_income_updates_totals_and_returns_sequential_ids() {
    let (env, client, treasurer) = setup();

    let first = client.record_income(
        &IncomeCategory::MembershipFee,
        &50_000,
        &desc(&env, "Sem 1 dues, 100 members"),
    );
    let second = client.record_income(
        &IncomeCategory::Sponsorship,
        &25_000,
        &desc(&env, "Local cafe sponsorship"),
    );

    assert_eq!(first, 1);
    assert_eq!(second, 2);

    let summary = client.get_summary();
    assert_eq!(summary.total_income, 75_000);
    assert_eq!(summary.total_expenses, 0);
    assert_eq!(summary.tx_count, 2);
    assert_eq!(client.get_balance(), 75_000);

    let tx = client.get_transaction(&1);
    assert_eq!(tx.amount, 50_000);
    assert_eq!(tx.recorded_by, treasurer);
    assert!(tx.category.is_income());
}

#[test]
fn recording_expense_subtracts_from_the_balance() {
    let (env, client, _) = setup();

    client.record_income(&IncomeCategory::Donation, &100_000, &desc(&env, "Alumni"));
    client.record_expense(&ExpenseCategory::Food, &30_000, &desc(&env, "Orientation"));
    client.record_expense(&ExpenseCategory::Printing, &5_500, &desc(&env, "Posters"));

    let summary = client.get_summary();
    assert_eq!(summary.total_income, 100_000);
    assert_eq!(summary.total_expenses, 35_500);
    assert_eq!(summary.tx_count, 3);
    assert_eq!(client.get_balance(), 64_500);
}

#[test]
fn balance_may_go_negative_to_surface_overspending() {
    let (env, client, _) = setup();

    client.record_income(&IncomeCategory::Merchandise, &10_000, &desc(&env, "Shirts"));
    client.record_expense(&ExpenseCategory::Venue, &18_000, &desc(&env, "Hall rental"));

    // A ledger that silently clamps at zero would hide exactly the problem
    // this project exists to expose.
    assert_eq!(client.get_balance(), -8_000);
}

#[test]
fn timestamp_comes_from_the_ledger_not_the_caller() {
    let (env, client, _) = setup();

    env.ledger().set_timestamp(1_800_000_000);
    client.record_income(&IncomeCategory::Other, &1_000, &desc(&env, "Raffle"));

    assert_eq!(client.get_transaction(&1).timestamp, 1_800_000_000);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

#[test]
fn zero_and_negative_amounts_are_rejected() {
    let (env, client, _) = setup();

    assert_eq!(
        client.try_record_income(&IncomeCategory::Donation, &0, &desc(&env, "nothing")),
        Err(Ok(TreasuryError::InvalidAmount))
    );
    assert_eq!(
        client.try_record_expense(&ExpenseCategory::Food, &-500, &desc(&env, "negative")),
        Err(Ok(TreasuryError::InvalidAmount))
    );

    assert_eq!(client.get_summary().tx_count, 0);
}

#[test]
fn overlong_descriptions_are_rejected() {
    let (env, client, _) = setup();

    // Built from bytes rather than `"x".repeat(201)` -- the crate is no_std,
    // so `str::repeat` (which needs alloc) is unavailable even in tests.
    let long = String::from_bytes(&env, &[b'x'; 201]);
    assert_eq!(
        client.try_record_income(&IncomeCategory::Other, &1_000, &long),
        Err(Ok(TreasuryError::DescriptionTooLong))
    );
}

#[test]
fn missing_transactions_report_not_found() {
    let (_env, client, _) = setup();

    assert_eq!(
        client.try_get_transaction(&99),
        Err(Ok(TreasuryError::TxNotFound))
    );
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

#[test]
fn recording_without_treasurer_authorization_fails() {
    // Note: no mock_all_auths() here, so require_auth is enforced for real.
    let env = Env::default();
    let contract_id = env.register(TreasuryContract, ());
    let client = TreasuryContractClient::new(&env, &contract_id);
    let treasurer = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&desc(&env, "CS Society"), &treasurer);

    // Replace the blanket mock with an empty allowlist: nothing is authorized
    // from this point on.
    env.mock_auths(&[]);

    assert!(client
        .try_record_income(&IncomeCategory::Donation, &1_000, &desc(&env, "sneaky"))
        .is_err());
    assert_eq!(client.get_summary().tx_count, 0);
}

// ---------------------------------------------------------------------------
// Archiving
// ---------------------------------------------------------------------------

#[test]
fn archiving_blocks_writes_but_never_reads() {
    let (env, client, _) = setup();

    client.record_income(&IncomeCategory::MembershipFee, &40_000, &desc(&env, "Dues"));
    client.archive();

    assert_eq!(client.get_organization().status, OrgStatus::Archived);

    assert_eq!(
        client.try_record_expense(&ExpenseCategory::Food, &1_000, &desc(&env, "after close")),
        Err(Ok(TreasuryError::OrgArchived))
    );

    // History remains fully readable -- that is the entire point.
    assert_eq!(client.get_summary().total_income, 40_000);
    assert_eq!(client.get_transaction(&1).amount, 40_000);
}

#[test]
fn archiving_twice_is_rejected() {
    let (_env, client, _) = setup();

    client.archive();
    assert_eq!(client.try_archive(), Err(Ok(TreasuryError::OrgArchived)));
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

#[test]
fn transactions_come_back_newest_first() {
    let (env, client, _) = setup();

    for i in 1..=5 {
        client.record_income(&IncomeCategory::Donation, &(i * 1_000), &desc(&env, "d"));
    }

    let page = client.get_transactions(&0, &10);
    assert_eq!(page.len(), 5);
    assert_eq!(page.get(0).unwrap().id, 5);
    assert_eq!(page.get(4).unwrap().id, 1);
}

#[test]
fn cursor_pages_backwards_through_history() {
    let (env, client, _) = setup();

    for _ in 0..10 {
        client.record_income(&IncomeCategory::Donation, &1_000, &desc(&env, "d"));
    }

    let first = client.get_transactions(&0, &4);
    assert_eq!(first.len(), 4);
    assert_eq!(first.get(0).unwrap().id, 10);
    assert_eq!(first.get(3).unwrap().id, 7);

    // Next page starts just below the last id we received.
    let second = client.get_transactions(&6, &4);
    assert_eq!(second.get(0).unwrap().id, 6);
    assert_eq!(second.get(3).unwrap().id, 3);

    let last = client.get_transactions(&2, &4);
    assert_eq!(last.len(), 2);
    assert_eq!(last.get(1).unwrap().id, 1);
}

#[test]
fn empty_history_returns_an_empty_page_not_an_error() {
    let (_env, client, _) = setup();

    assert_eq!(client.get_transactions(&0, &10).len(), 0);
}

#[test]
fn bad_limits_are_rejected() {
    let (_env, client, _) = setup();

    assert_eq!(
        client.try_get_transactions(&0, &0),
        Err(Ok(TreasuryError::InvalidLimit))
    );
    assert_eq!(
        client.try_get_transactions(&0, &(MAX_PAGE_LIMIT + 1)),
        Err(Ok(TreasuryError::InvalidLimit))
    );
}
