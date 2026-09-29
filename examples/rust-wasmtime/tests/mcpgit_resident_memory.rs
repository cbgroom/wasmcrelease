use std::{error::Error, fs, path::PathBuf};

use wasmtime::{
    Engine, Store,
    component::{Component, Func, Linker, ResourceAny, Val},
};

fn release_file(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

fn record(fields: impl IntoIterator<Item = (&'static str, Val)>) -> Val {
    Val::Record(
        fields
            .into_iter()
            .map(|(name, value)| (name.into(), value))
            .collect(),
    )
}

fn bytes(bytes: &[u8]) -> Val {
    Val::List(bytes.iter().copied().map(Val::U8).collect())
}

fn some(value: Val) -> Val {
    Val::Option(Some(Box::new(value)))
}

fn none() -> Val {
    Val::Option(None)
}

fn call(func: &Func, store: &mut Store<()>, params: &[Val]) -> Result<Val, Box<dyn Error>> {
    let mut results = [Val::Bool(false)];
    func.call(store, params, &mut results)?;
    Ok(std::mem::replace(&mut results[0], Val::Bool(false)))
}

fn ok_resource(value: Val) -> Result<ResourceAny, Box<dyn Error>> {
    match value {
        Val::Result(Ok(Some(value))) => match *value {
            Val::Resource(resource) => Ok(resource),
            other => Err(format!("expected resource result, got {other:?}").into()),
        },
        other => Err(format!("expected ok result, got {other:?}").into()),
    }
}

fn ok_record(value: Val) -> Result<Vec<(String, Val)>, Box<dyn Error>> {
    match value {
        Val::Result(Ok(Some(value))) => match *value {
            Val::Record(fields) => Ok(fields),
            other => Err(format!("expected record result, got {other:?}").into()),
        },
        other => Err(format!("expected ok result, got {other:?}").into()),
    }
}

fn field<'a>(fields: &'a [(String, Val)], name: &str) -> Result<&'a Val, Box<dyn Error>> {
    fields
        .iter()
        .find_map(|(candidate, value)| (candidate == name).then_some(value))
        .ok_or_else(|| format!("record field {name} missing").into())
}

fn get_func(
    component: &Component,
    instance: &wasmtime::component::Instance,
    store: &mut Store<()>,
    interface: &wasmtime::component::ComponentExportIndex,
    name: &str,
) -> Result<Func, Box<dyn Error>> {
    let index = component
        .get_export_index(Some(interface), name)
        .ok_or_else(|| format!("component export {name} missing"))?;
    instance
        .get_func(store, &index)
        .ok_or_else(|| format!("component function {name} missing").into())
}

#[test]
fn source_free_resident_component_preserves_snapshot_cas_and_range_semantics()
-> Result<(), Box<dyn Error>> {
    let engine = Engine::default();
    let component = Component::new(
        &engine,
        fs::read(release_file(
            "libs/mcpgit-resident-memory/component.wasm",
        ))?,
    )?;
    let mut store = Store::new(&engine, ());
    let instance = Linker::new(&engine).instantiate(&mut store, &component)?;
    let interface = component
        .get_export_index(None, "mcpgit:resident-memory/memory@0.1.0")
        .ok_or("resident memory interface missing")?;

    let open = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[static]store.open",
    )?;
    let pin_current = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]store.pin-current",
    )?;
    let publish = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]store.publish",
    )?;
    let budget = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]store.budget",
    )?;
    let snapshot_revision = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]snapshot.revision",
    )?;
    let snapshot_stat = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]snapshot.stat",
    )?;
    let snapshot_read = get_func(
        &component,
        &instance,
        &mut store,
        &interface,
        "[method]snapshot.read",
    )?;

    let revision_1 = [1_u8; 20];
    let revision_2 = [2_u8; 20];
    let object = record([
        ("locator", Val::String("content/body.bin".into())),
        ("role", some(Val::String("body".into()))),
        ("media-type", Val::String("application/octet-stream".into())),
        ("mode", Val::String("binary".into())),
        ("object-version", Val::String("blob-v1".into())),
        ("content", bytes(b"abcde")),
    ]);
    let aggregate = record([
        ("key", Val::String("agent/alpha".into())),
        ("row-version", Val::U64(1)),
        ("aggregate-version", Val::String("row-v1".into())),
        ("objects", Val::List(vec![object])),
    ]);
    let history = record([
        ("max-retained-generations", Val::U64(8)),
        ("max-reflog-entries", Val::U64(16)),
        ("max-refs", Val::U64(8)),
    ]);
    let resident = ok_resource(call(
        &open,
        &mut store,
        &[
            bytes(&revision_1),
            Val::List(vec![aggregate]),
            Val::U64(1024 * 1024),
            history,
        ],
    )?)?;

    let budget_value = call(&budget, &mut store, &[Val::Resource(resident.clone())])?;
    let Val::Record(budget_fields) = budget_value else {
        return Err("budget did not return a record".into());
    };
    assert_eq!(
        field(&budget_fields, "limit-bytes")?,
        &Val::U64(1024 * 1024)
    );
    assert!(matches!(field(&budget_fields, "used-bytes")?, Val::U64(value) if *value > 0));

    let snapshot_1 = ok_resource(call(
        &pin_current,
        &mut store,
        &[Val::Resource(resident.clone())],
    )?)?;
    assert_eq!(
        call(
            &snapshot_revision,
            &mut store,
            &[Val::Resource(snapshot_1.clone())],
        )?,
        bytes(&revision_1)
    );
    let stat = ok_record(call(
        &snapshot_stat,
        &mut store,
        &[
            Val::Resource(snapshot_1.clone()),
            Val::String("agent/alpha".into()),
        ],
    )?)?;
    assert_eq!(field(&stat, "object-count")?, &Val::U64(1));
    assert_eq!(field(&stat, "object-bytes")?, &Val::U64(5));

    let before = ok_record(call(
        &snapshot_read,
        &mut store,
        &[
            Val::Resource(snapshot_1.clone()),
            Val::String("agent/alpha".into()),
            Val::String("content/body.bin".into()),
            Val::String("blob-v1".into()),
            some(record([("start", Val::U64(1)), ("end", Val::U64(4))])),
        ],
    )?)?;
    assert_eq!(field(&before, "bytes")?, &bytes(b"bcd"));

    let patch = record([
        ("locator", Val::String("content/body.bin".into())),
        ("expected-object-version", Val::String("blob-v1".into())),
        ("next-object-version", Val::String("blob-v2".into())),
        ("offset", Val::U64(1)),
        ("delete-length", Val::U64(2)),
        ("expected-slice-digest", none()),
        ("data", bytes(b"XY")),
    ]);
    let change = record([
        ("key", Val::String("agent/alpha".into())),
        ("row-version", Val::U64(2)),
        ("aggregate-version", Val::String("row-v2".into())),
        ("deleted", Val::Bool(false)),
        (
            "objects",
            Val::List(vec![Val::Variant("patch".into(), Some(Box::new(patch)))]),
        ),
    ]);
    let snapshot_2 = ok_resource(call(
        &publish,
        &mut store,
        &[
            Val::Resource(resident.clone()),
            bytes(&revision_1),
            bytes(&revision_2),
            Val::U64(2),
            Val::List(vec![change.clone()]),
        ],
    )?)?;

    let after = ok_record(call(
        &snapshot_read,
        &mut store,
        &[
            Val::Resource(snapshot_2.clone()),
            Val::String("agent/alpha".into()),
            Val::String("content/body.bin".into()),
            Val::String("blob-v2".into()),
            none(),
        ],
    )?)?;
    assert_eq!(field(&after, "bytes")?, &bytes(b"aXYde"));

    let old_again = ok_record(call(
        &snapshot_read,
        &mut store,
        &[
            Val::Resource(snapshot_1.clone()),
            Val::String("agent/alpha".into()),
            Val::String("content/body.bin".into()),
            Val::String("blob-v1".into()),
            none(),
        ],
    )?)?;
    assert_eq!(field(&old_again, "bytes")?, &bytes(b"abcde"));

    match call(
        &publish,
        &mut store,
        &[
            Val::Resource(resident.clone()),
            bytes(&revision_1),
            bytes(&[3_u8; 20]),
            Val::U64(3),
            Val::List(vec![change]),
        ],
    )? {
        Val::Result(Err(Some(error))) => match *error {
            Val::Record(fields) => {
                assert_eq!(field(&fields, "code")?, &Val::Enum("conflict".into()))
            }
            other => return Err(format!("expected resident error record, got {other:?}").into()),
        },
        other => return Err(format!("stale publication unexpectedly returned {other:?}").into()),
    }

    snapshot_2.resource_drop(&mut store)?;
    snapshot_1.resource_drop(&mut store)?;
    resident.resource_drop(&mut store)?;
    Ok(())
}
