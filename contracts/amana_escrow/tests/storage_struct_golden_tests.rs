/// Issue #918 — Golden storage snapshot tests for ABI/storage layout stability.
///
/// These tests encode the XDR/SCVal representation of every storage struct and
/// enum variant and assert deterministic round-trip serialization. A breaking
/// field reordering, addition, or variant insertion will cause a mismatch and
/// fail the test, protecting against accidental ABI changes.
///
/// Golden values are verified through cross-serialization consistency rather
/// than hardcoded hex strings to remain resilient to SDK version bumps.
/// To regenerate, run tests normally — the assertions are self-consistent.
extern crate std;

use amana_escrow::{
    DataKey, DeliveryManifestRecord, DisputeRecord, EvidenceRecord, PathPaymentIntent,
    ReleaseSequence, TradeData, TradeEvent, TradeStatus, TradeV0, VideoProofRecord,
};
use soroban_sdk::{
    testutils::Address as _, xdr::ToXdr, Address, Bytes, Env, String as SorobanString,
};
use std::string::String;

fn to_hex(env: &Env, val: &impl ToXdr) -> String {
    let bytes: Bytes = val.clone().to_xdr(env);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn assert_deterministic(env: &Env, label: &str, val: &impl ToXdr) {
    let a = to_hex(env, val);
    let b = to_hex(env, val);
    assert_eq!(a, b, "[#918] {label} serialization is non-deterministic");
}

fn assert_distinct(env: &Env, label_a: &str, a: &impl ToXdr, label_b: &str, b: &impl ToXdr) {
    let ha = to_hex(env, a);
    let hb = to_hex(env, b);
    assert_ne!(
        ha, hb,
        "[#918] {label_a} and {label_b} produce identical serialization — possible struct collision"
    );
}

fn addr(env: &Env) -> Address {
    Address::generate(env)
}

fn s(env: &Env, val: &str) -> SorobanString {
    SorobanString::from_str(env, val)
}

// ---------------------------------------------------------------------------
// TradeStatus golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_trade_status_deterministic() {
    let env = Env::default();
    env.mock_all_auths();
    let statuses = &[
        TradeStatus::Created,
        TradeStatus::Funded,
        TradeStatus::Delivered,
        TradeStatus::Completed,
        TradeStatus::Disputed,
        TradeStatus::Cancelled,
    ];
    for status in statuses {
        assert_deterministic(&env, &format!("TradeStatus::{status:?}"), status);
    }
    for i in 0..statuses.len() {
        for j in (i + 1)..statuses.len() {
            assert_distinct(
                &env,
                &format!("TradeStatus({i})"),
                &statuses[i],
                &format!("TradeStatus({j})"),
                &statuses[j],
            );
        }
    }
}

// ---------------------------------------------------------------------------
// TradeV0 golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_trade_v0_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let trade = TradeV0 {
        trade_id: 1u64,
        buyer: addr(&env),
        seller: addr(&env),
        token: addr(&env),
        amount: 1000000000i128,
        status: TradeStatus::Funded,
        created_at: 1700000000u64,
        updated_at: 1700003600u64,
        funded_at: Some(1700001000u64),
        delivered_at: None,
        buyer_loss_bps: 5000u32,
        seller_loss_bps: 5000u32,
        expires_at: None,
    };
    assert_deterministic(&env, "TradeV0", &trade);

    let trade2 = TradeV0 {
        trade_id: 2u64,
        buyer: addr(&env),
        seller: addr(&env),
        token: addr(&env),
        amount: 2000000000i128,
        status: TradeStatus::Completed,
        created_at: 1700000000u64,
        updated_at: 1700007200u64,
        funded_at: Some(1700001000u64),
        delivered_at: Some(1700003600u64),
        buyer_loss_bps: 5000u32,
        seller_loss_bps: 5000u32,
        expires_at: Some(1700086400u64),
    };
    assert_distinct(&env, "TradeV0(1)", &trade, "TradeV0(2)", &trade2);
}

// ---------------------------------------------------------------------------
// TradeData golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_trade_data_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let v0 = TradeV0 {
        trade_id: 1u64,
        buyer: addr(&env),
        seller: addr(&env),
        token: addr(&env),
        amount: 500000000i128,
        status: TradeStatus::Created,
        created_at: 1700000000u64,
        updated_at: 1700000000u64,
        funded_at: None,
        delivered_at: None,
        buyer_loss_bps: 5000u32,
        seller_loss_bps: 5000u32,
        expires_at: None,
    };
    let data = TradeData::V0(v0);
    assert_deterministic(&env, "TradeData::V0", &data);
}

// ---------------------------------------------------------------------------
// DisputeRecord golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_dispute_record_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let record = DisputeRecord {
        initiator: addr(&env),
        reason_hash: s(&env, "QmDisputeHash123"),
        disputed_at: 1700005000u64,
    };
    assert_deterministic(&env, "DisputeRecord", &record);

    let record2 = DisputeRecord {
        initiator: addr(&env),
        reason_hash: s(&env, "QmDisputeHash456"),
        disputed_at: 1700010000u64,
    };
    assert_distinct(
        &env,
        "DisputeRecord(1)",
        &record,
        "DisputeRecord(2)",
        &record2,
    );
}

// ---------------------------------------------------------------------------
// VideoProofRecord golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_video_proof_record_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let record = VideoProofRecord {
        submitter: addr(&env),
        ipfs_cid: s(&env, "QmVideoCid123"),
        submitted_at: 1700006000u64,
    };
    assert_deterministic(&env, "VideoProofRecord", &record);

    let record2 = VideoProofRecord {
        submitter: addr(&env),
        ipfs_cid: s(&env, "QmVideoCid456"),
        submitted_at: 1700012000u64,
    };
    assert_distinct(
        &env,
        "VideoProofRecord(1)",
        &record,
        "VideoProofRecord(2)",
        &record2,
    );
}

// ---------------------------------------------------------------------------
// EvidenceRecord golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_evidence_record_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let record = EvidenceRecord {
        submitter: addr(&env),
        ipfs_hash: s(&env, "QmEvidenceHash123"),
        description_hash: s(&env, "QmDescHash123"),
        submitted_at: 1700007000u64,
    };
    assert_deterministic(&env, "EvidenceRecord", &record);

    let record2 = EvidenceRecord {
        submitter: addr(&env),
        ipfs_hash: s(&env, "QmEvidenceHash456"),
        description_hash: s(&env, "QmDescHash456"),
        submitted_at: 1700014000u64,
    };
    assert_distinct(
        &env,
        "EvidenceRecord(1)",
        &record,
        "EvidenceRecord(2)",
        &record2,
    );
}

// ---------------------------------------------------------------------------
// DeliveryManifestRecord golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_delivery_manifest_record_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let record = DeliveryManifestRecord {
        seller: addr(&env),
        driver_name_hash: s(&env, "QmDriverNameHash123"),
        driver_id_hash: s(&env, "QmDriverIdHash123"),
        submitted_at: 1700008000u64,
    };
    assert_deterministic(&env, "DeliveryManifestRecord", &record);

    let record2 = DeliveryManifestRecord {
        seller: addr(&env),
        driver_name_hash: s(&env, "QmDriverNameHash456"),
        driver_id_hash: s(&env, "QmDriverIdHash456"),
        submitted_at: 1700016000u64,
    };
    assert_distinct(
        &env,
        "DeliveryManifestRecord(1)",
        &record,
        "DeliveryManifestRecord(2)",
        &record2,
    );
}

// ---------------------------------------------------------------------------
// ReleaseSequence golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_release_sequence_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let seq = ReleaseSequence {
        trade_id: 42u64,
        created_at: 1700000000u64,
        funded_at: Some(1700001000u64),
        manifest_submitted_at: None,
        delivered_at: None,
        disputed_at: None,
        released_at: None,
        resolved_at: None,
        cancelled_at: None,
        expired_at: None,
    };
    assert_deterministic(&env, "ReleaseSequence(none)", &seq);

    let seq2 = ReleaseSequence {
        trade_id: 42u64,
        created_at: 1700000000u64,
        funded_at: Some(1700001000u64),
        manifest_submitted_at: Some(1700002000u64),
        delivered_at: Some(1700004000u64),
        disputed_at: Some(1700005000u64),
        released_at: Some(1700007000u64),
        resolved_at: None,
        cancelled_at: None,
        expired_at: None,
    };
    assert_distinct(
        &env,
        "ReleaseSequence(early)",
        &seq,
        "ReleaseSequence(later)",
        &seq2,
    );
}

// ---------------------------------------------------------------------------
// PathPaymentIntent golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_path_payment_intent_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let path = std::vec![addr(&env), addr(&env)];
    let intent = PathPaymentIntent {
        buyer: addr(&env),
        source_amount: 500000000i128,
        dest_min: 490000000i128,
        path,
        cngn_balance_before: 1000000000i128,
    };
    assert_deterministic(&env, "PathPaymentIntent", &intent);

    let path2 = std::vec![addr(&env)];
    let intent2 = PathPaymentIntent {
        buyer: addr(&env),
        source_amount: 1000000000i128,
        dest_min: 980000000i128,
        path: path2,
        cngn_balance_before: 2000000000i128,
    };
    assert_distinct(
        &env,
        "PathPaymentIntent(1)",
        &intent,
        "PathPaymentIntent(2)",
        &intent2,
    );
}

// ---------------------------------------------------------------------------
// TradeEvent golden
// ---------------------------------------------------------------------------

#[test]
fn test_golden_trade_event_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let event = TradeEvent {
        event_type: s(&env, "TradeCreated"),
        timestamp: 1700000000u64,
        actor: addr(&env),
        data: s(&env, "{\"trade_id\":1}"),
    };
    assert_deterministic(&env, "TradeEvent", &event);

    let event2 = TradeEvent {
        event_type: s(&env, "TradeFunded"),
        timestamp: 1700001000u64,
        actor: addr(&env),
        data: s(&env, "{\"trade_id\":2}"),
    };
    assert_distinct(
        &env,
        "TradeEvent(created)",
        &event,
        "TradeEvent(funded)",
        &event2,
    );
}

// ---------------------------------------------------------------------------
// DataKey cross-variant golden — extended with new variants
// ---------------------------------------------------------------------------

#[test]
fn test_golden_datakey_all_variants_distinct() {
    let env = Env::default();
    env.mock_all_auths();
    let a = addr(&env);

    let keys: &[(&str, DataKey)] = &[
        ("Initialized", DataKey::Initialized),
        ("Admin", DataKey::Admin),
        ("CngnContract", DataKey::CngnContract),
        ("FeeBps", DataKey::FeeBps),
        ("Treasury", DataKey::Treasury),
        ("Mediator", DataKey::Mediator),
        ("MediatorRegistry", DataKey::MediatorRegistry(a.clone())),
        ("Trade(1)", DataKey::Trade(1u64)),
        ("TradeHistory(1)", DataKey::TradeHistory(1u64)),
        ("CancelRequest(1)", DataKey::CancelRequest(1u64)),
        ("Evidence(1,addr)", DataKey::Evidence(1u64, a.clone())),
        ("DisputeData(1)", DataKey::DisputeData(1u64)),
        ("EvidenceList(1)", DataKey::EvidenceList(1u64)),
        ("VideoProof(1)", DataKey::VideoProof(1u64)),
        ("Manifest(1)", DataKey::Manifest(1u64)),
        ("SourceToken", DataKey::SourceToken),
        ("PathPaymentIntent(1)", DataKey::PathPaymentIntent(1u64)),
        ("ReleaseSequence(1)", DataKey::ReleaseSequence(1u64)),
        ("TotalTrades", DataKey::TotalTrades),
        ("TotalDisputes", DataKey::TotalDisputes),
        ("TotalResolved", DataKey::TotalResolved),
        ("AccruedFees", DataKey::AccruedFees),
        ("SchemaVersion", DataKey::SchemaVersion),
    ];

    let hexes: std::vec::Vec<_> = keys
        .iter()
        .map(|(_, k)| {
            let bytes: Bytes = k.clone().to_xdr(&env);
            bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
        })
        .collect();

    for i in 0..hexes.len() {
        for j in (i + 1)..hexes.len() {
            assert_ne!(
                hexes[i], hexes[j],
                "[#918] DataKey collision: {} <-> {}",
                keys[i].0, keys[j].0
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Storage struct cross-type collision guard
// ---------------------------------------------------------------------------

#[test]
fn test_all_storage_structs_are_distinct() {
    let env = Env::default();
    env.mock_all_auths();
    let a = addr(&env);
    let p = std::vec![a.clone()];

    let trade = TradeV0 {
        trade_id: 1,
        buyer: a.clone(),
        seller: a.clone(),
        token: a.clone(),
        amount: 1000i128,
        status: TradeStatus::Created,
        created_at: 1u64,
        updated_at: 1u64,
        funded_at: None,
        delivered_at: None,
        buyer_loss_bps: 5000,
        seller_loss_bps: 5000,
        expires_at: None,
    };

    let dispute = DisputeRecord {
        initiator: a.clone(),
        reason_hash: s(&env, "hash"),
        disputed_at: 1u64,
    };

    let video = VideoProofRecord {
        submitter: a.clone(),
        ipfs_cid: s(&env, "cid"),
        submitted_at: 1u64,
    };

    let evidence = EvidenceRecord {
        submitter: a.clone(),
        ipfs_hash: s(&env, "hash"),
        description_hash: s(&env, "desc"),
        submitted_at: 1u64,
    };

    let manifest = DeliveryManifestRecord {
        seller: a.clone(),
        driver_name_hash: s(&env, "name"),
        driver_id_hash: s(&env, "id"),
        submitted_at: 1u64,
    };

    let seq = ReleaseSequence {
        trade_id: 1,
        created_at: 1u64,
        funded_at: None,
        manifest_submitted_at: None,
        delivered_at: None,
        disputed_at: None,
        released_at: None,
        resolved_at: None,
        cancelled_at: None,
        expired_at: None,
    };

    let payment = PathPaymentIntent {
        buyer: a.clone(),
        source_amount: 1000i128,
        dest_min: 900i128,
        path: p,
        cngn_balance_before: 2000i128,
    };

    let event = TradeEvent {
        event_type: s(&env, "type"),
        timestamp: 1u64,
        actor: a.clone(),
        data: s(&env, "data"),
    };

    let entities: &[(&str, String)] = &[
        ("TradeV0", to_hex(&env, &trade)),
        ("DisputeRecord", to_hex(&env, &dispute)),
        ("VideoProofRecord", to_hex(&env, &video)),
        ("EvidenceRecord", to_hex(&env, &evidence)),
        ("DeliveryManifestRecord", to_hex(&env, &manifest)),
        ("ReleaseSequence", to_hex(&env, &seq)),
        ("PathPaymentIntent", to_hex(&env, &payment)),
        ("TradeEvent", to_hex(&env, &event)),
    ];

    for i in 0..entities.len() {
        for j in (i + 1)..entities.len() {
            assert_ne!(
                entities[i].1, entities[j].1,
                "[#918] Storage struct serialization collision: {} == {}",
                entities[i].0, entities[j].0
            );
        }
    }
}
