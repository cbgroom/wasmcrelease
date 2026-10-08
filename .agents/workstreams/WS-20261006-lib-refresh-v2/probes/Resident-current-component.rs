use resident_component::{Lib, wasmtime};
use resident_component::exports::mcpgit::resident_memory::memory::*;
use wasmtime::component::{Component, Linker};

fn object(locator: &str, bytes: &[u8]) -> ObjectInput {
    ObjectInput { locator: locator.into(), role: Some("source".into()), media_type: "application/octet-stream".into(),
        mode: "100644".into(), object_version: "o1".into(), content: bytes.to_vec() }
}
fn aggregate(key: &str) -> AggregateInput {
    AggregateInput { key: key.into(), row_version: 1, aggregate_version: "a1".into(), objects: vec![object("a", b"abcdef"), object("b", b"xyz")] }
}
fn history() -> HistoryPolicy { HistoryPolicy { max_retained_generations: 0, max_reflog_entries: 8, max_refs: 8 } }
fn main() {
    let engine = wasmtime::Engine::default();
    let component = Component::from_file(&engine, std::env::args().nth(1).unwrap()).unwrap();
    let mut store = wasmtime::Store::new(&engine, ());
    let lib = Lib::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
    let api = lib.mcpgit_resident_memory_memory();
    let mut drops = 0u64;
    let mut checks = 0u64;
    for _ in 0..256 {
        let r1 = [1u8;20]; let r2 = [2u8;20]; let r3 = [3u8;20];
        assert!(matches!(api.store().call_open(&mut store, &[1], &[], 1048576, history()).unwrap().unwrap_err().code, ErrorCode::InvalidRevision)); checks += 1;
        assert!(matches!(api.store().call_open(&mut store, &r1, &[aggregate("x"), aggregate("x")], 1048576, history()).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
        assert!(matches!(api.store().call_open(&mut store, &r1, &[aggregate("x")], 1, history()).unwrap().unwrap_err().code, ErrorCode::BudgetExceeded)); checks += 1;
        let root = api.store().call_open(&mut store, &r1, &[aggregate("x")], 1048576, history()).unwrap().unwrap();
        let baseline = api.store().call_budget(&mut store, root).unwrap();
        assert!(baseline.used_bytes > 0 && baseline.used_bytes < baseline.limit_bytes); checks += 1;
        let old = api.store().call_pin_current(&mut store, root).unwrap().unwrap();
        assert_eq!(api.snapshot().call_revision(&mut store, old).unwrap(), r1); checks += 1;
        assert_eq!(api.snapshot().call_sequence(&mut store, old).unwrap(), 1); checks += 1;
        let stat = api.snapshot().call_stat(&mut store, old, "x").unwrap().unwrap();
        assert_eq!((stat.object_count, stat.object_bytes, stat.largest_object_bytes), (2,9,6));
        assert_eq!(stat.objects_by_role[0].role, "source"); checks += 2;
        let page = api.snapshot().call_list_objects(&mut store, old, "x", None, 1).unwrap().unwrap();
        assert!(page.truncated && page.objects.len()==1 && page.next_after.as_deref()==Some("a")); checks += 1;
        let page = api.snapshot().call_list_objects(&mut store, old, "x", Some("a"), 1).unwrap().unwrap();
        assert!(!page.truncated && page.objects[0].locator=="b"); checks += 1;
        let range = ByteRange { start: 1, end: 4 };
        assert_eq!(api.snapshot().call_read(&mut store, old, "x", "a", "o1", Some(range)).unwrap().unwrap().bytes, b"bcd"); checks += 1;
        let range = ByteRange { start: 0, end: 7 };
        assert!(matches!(api.snapshot().call_read(&mut store, old, "x", "a", "o1", Some(range)).unwrap().unwrap_err().code, ErrorCode::InvalidRange)); checks += 1;
        assert!(matches!(api.snapshot().call_read(&mut store, old, "x", "a", "wrong", None).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
        let bad = AggregateChange { key: "x".into(), row_version: 2, aggregate_version: "a2".into(), deleted: false,
            objects: vec![ObjectMutation::Put(object("c", b"pending")), ObjectMutation::Patch(ReplaceRange {
                locator: "a".into(), expected_object_version: "o1".into(), next_object_version: "o2".into(),
                offset: 1, delete_length: 3, expected_slice_digest: Some("0".repeat(64)), data: b"XY".to_vec() })] };
        assert!(matches!(api.store().call_publish(&mut store, root, &r1, &r2, 2, &[bad]).unwrap().unwrap_err().code, ErrorCode::Integrity)); checks += 1;
        assert_eq!(api.store().call_budget(&mut store, root).unwrap().used_bytes, baseline.used_bytes); checks += 1;
        let current = api.store().call_pin_current(&mut store, root).unwrap().unwrap();
        assert_eq!(api.snapshot().call_stat(&mut store, current, "x").unwrap().unwrap().object_count, 2); checks += 1;
        current.resource_drop(&mut store).unwrap(); drops += 1;
        let good = AggregateChange { key: "x".into(), row_version: 2, aggregate_version: "a2".into(), deleted: false,
            objects: vec![ObjectMutation::Patch(ReplaceRange { locator: "a".into(), expected_object_version: "o1".into(),
                next_object_version: "o2".into(), offset: 1, delete_length: 3, expected_slice_digest: Some("a6b0f90d2ac2b8d1f250c687301aef132049e9016df936680e81fa7bc7d81d70".into()), data: b"XY".to_vec() }),
                ObjectMutation::Move(MoveObject { locator: "b".into(), next_locator: "z".into(), next_object_version: "o2".into() })] };
        let fresh = api.store().call_publish(&mut store, root, &r1, &r2, 2, &[good]).unwrap().unwrap();
        assert_eq!(api.snapshot().call_read(&mut store, fresh, "x", "a", "o2", None).unwrap().unwrap().bytes, b"aXYef"); checks += 1;
        assert_eq!(api.snapshot().call_read(&mut store, old, "x", "a", "o1", None).unwrap().unwrap().bytes, b"abcdef"); checks += 1;
        assert_eq!(api.snapshot().call_sequence(&mut store, fresh).unwrap(), 2); checks += 1;
        let same = api.store().call_pin_revision(&mut store, root, &r2).unwrap().unwrap();
        assert_eq!(api.snapshot().call_revision(&mut store, same).unwrap(), r2); checks += 1;
        same.resource_drop(&mut store).unwrap(); drops += 1;
        assert!(matches!(api.store().call_publish(&mut store, root, &r1, &r3, 3, &[]).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
        assert!(matches!(api.store().call_publish(&mut store, root, &r2, &r3, 2, &[]).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
        assert!(matches!(api.snapshot().call_list_objects(&mut store, fresh, "x", None, 0).unwrap().unwrap_err().code, ErrorCode::InvalidInput)); checks += 1;
        let oversized = AggregateChange { key: "x".into(), row_version: 3, aggregate_version: "a3".into(), deleted: false, objects: vec![ObjectMutation::Put(object("large", &vec![255;524288]))] };
        let before_failure = api.store().call_budget(&mut store, root).unwrap().used_bytes;
        assert!(matches!(api.store().call_publish(&mut store, root, &r2, &r3, 3, &[oversized]).unwrap().unwrap_err().code, ErrorCode::BudgetExceeded)); checks += 1;
        assert_eq!(api.store().call_budget(&mut store, root).unwrap().used_bytes, before_failure); checks += 1;
        let collision = AggregateChange { key: "x".into(), row_version: 3, aggregate_version: "a3".into(), deleted: false, objects: vec![ObjectMutation::Move(MoveObject { locator: "a".into(), next_locator: "z".into(), next_object_version: "o3".into() })] };
        assert!(matches!(api.store().call_publish(&mut store, root, &r2, &r3, 3, &[collision]).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
        let with_pin = api.store().call_budget(&mut store, root).unwrap().used_bytes;
        old.resource_drop(&mut store).unwrap(); drops += 1;
        let released = api.store().call_budget(&mut store, root).unwrap().used_bytes;
        assert!(released < with_pin); checks += 1;
        let change = AggregateChange { key: "x".into(), row_version: 3, aggregate_version: "a3".into(), deleted: false,
            objects: vec![ObjectMutation::Delete("z".into()), ObjectMutation::Put(object("c", b"new"))] };
        let add = AggregateChange { key: "y".into(), row_version: 1, aggregate_version: "a1".into(), deleted: false,
            objects: vec![ObjectMutation::Put(object("item", b"other"))] };
        let newest = api.store().call_publish(&mut store, root, &r2, &r3, 3, &[change, add]).unwrap().unwrap();
        assert_eq!(api.snapshot().call_stat(&mut store, newest, "y").unwrap().unwrap().object_bytes, 5); checks += 1;
        assert!(matches!(api.snapshot().call_read(&mut store, newest, "x", "z", "o2", None).unwrap().unwrap_err().code, ErrorCode::NotFound)); checks += 1;
        let deletion = AggregateChange { key: "x".into(), row_version: 4, aggregate_version: "a4".into(), deleted: true, objects: vec![] };
        let removed = api.store().call_publish(&mut store, root, &r3, &[4;20], 4, &[deletion]).unwrap().unwrap();
        assert!(matches!(api.snapshot().call_stat(&mut store, removed, "x").unwrap().unwrap_err().code, ErrorCode::NotFound)); checks += 1;
        assert_eq!(api.snapshot().call_stat(&mut store, newest, "x").unwrap().unwrap().object_count, 2); checks += 1;
        removed.resource_drop(&mut store).unwrap(); drops += 1;
        fresh.resource_drop(&mut store).unwrap(); drops += 1;
        root.resource_drop(&mut store).unwrap(); drops += 1;
        assert_eq!(api.snapshot().call_read(&mut store, newest, "y", "item", "o1", None).unwrap().unwrap().bytes, b"other"); checks += 1;
        newest.resource_drop(&mut store).unwrap(); drops += 1;
    }
    let retained = HistoryPolicy { max_retained_generations: 2, max_reflog_entries: 8, max_refs: 8 };
    let root = api.store().call_open(&mut store, &[1;20], &[aggregate("history")], 1048576, retained).unwrap().unwrap();
    let next = api.store().call_publish(&mut store, root, &[1;20], &[2;20], 2, &[]).unwrap().unwrap();
    let previous = api.store().call_pin_revision(&mut store, root, &[1;20]).unwrap().unwrap();
    assert_eq!(api.snapshot().call_sequence(&mut store, previous).unwrap(), 1); checks += 1;
    assert_eq!(api.snapshot().call_read(&mut store, previous, "history", "a", "o1", None).unwrap().unwrap().bytes, b"abcdef"); checks += 1;
    assert!(matches!(api.store().call_pin_revision(&mut store, root, &[99;20]).unwrap().unwrap_err().code, ErrorCode::NotFound)); checks += 1;
    assert!(matches!(api.store().call_publish(&mut store, root, &[2;20], &[1;20], 3, &[]).unwrap().unwrap_err().code, ErrorCode::Conflict)); checks += 1;
    next.resource_drop(&mut store).unwrap(); previous.resource_drop(&mut store).unwrap(); root.resource_drop(&mut store).unwrap(); drops += 3;
    // An invalid owned resource call traps at the Component boundary. Keep it
    // terminal; a trapped instance does not promise continued entry.
    let root = api.store().call_open(&mut store, &[1;20], &[], 1048576, history()).unwrap().unwrap();
    let snapshot = api.store().call_pin_current(&mut store, root).unwrap().unwrap();
    root.resource_drop(&mut store).unwrap(); drops += 1;
    assert_eq!(api.snapshot().call_sequence(&mut store, snapshot).unwrap(), 1); checks += 1;
    snapshot.resource_drop(&mut store).unwrap(); drops += 1;
    assert!(api.snapshot().call_sequence(&mut store, snapshot).is_err()); checks += 1;
    println!(r#"{{"accepted":true,"engine":"wasmtime-component","version":"49.0.0","rounds":256,"functions":10,"checks":{},"explicit_drops":{},"persistent_instance":true}}"#, checks, drops);
}
