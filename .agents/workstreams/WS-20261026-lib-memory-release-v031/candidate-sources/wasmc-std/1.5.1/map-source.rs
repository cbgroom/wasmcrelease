use std::cell::RefCell;
use std::collections::BTreeMap;

const ERR_INVALID_REFERENCE: i32 = 0x103;
static mut TOKEN_TYPE: i64 = 0;
thread_local! {
    static MAPS: RefCell<BTreeMap<i64, BTreeMap<i32, i32>>> = RefCell::new(BTreeMap::new());
}

#[link(wasm_import_module = "wasmc:lib/wasmc.lib_managed_object_heap@4.9.0")]
unsafe extern "C" {
    fn type_bytes() -> i64;
    fn list_new(element_type: i64) -> i64;
    fn list_drop(reference: i64, element_type: i64) -> i32;
}

fn token_type() -> i64 {
    let ty = unsafe { TOKEN_TYPE };
    assert!(ty < 0, "map provider is uninitialized");
    ty
}
fn option(value: Option<i32>) -> i64 {
    value.map_or(0, |v| ((1u64 << 32) | u64::from(v as u32)) as i64)
}
fn with_map<R>(reference: i64, f: impl FnOnce(&BTreeMap<i32, i32>) -> R) -> R {
    MAPS.with_borrow(|maps| maps.get(&reference).map(f)).expect("invalid map reference")
}
fn with_map_mut<R>(reference: i64, f: impl FnOnce(&mut BTreeMap<i32, i32>) -> R) -> R {
    MAPS.with_borrow_mut(|maps| maps.get_mut(&reference).map(f)).expect("invalid map reference")
}

#[unsafe(export_name = "std_map_fast_init")]
pub extern "C" fn init() -> i32 {
    unsafe {
        if TOKEN_TYPE != 0 { return ERR_INVALID_REFERENCE; }
        let ty = type_bytes();
        if ty >= 0 { return ERR_INVALID_REFERENCE; }
        TOKEN_TYPE = ty;
    }
    0
}
#[unsafe(export_name = "std_map_new")]
pub extern "C" fn new() -> i64 {
    let reference = unsafe { list_new(token_type()) };
    if reference < 0 {
        MAPS.with_borrow_mut(|maps| assert!(maps.insert(reference, BTreeMap::new()).is_none()));
    }
    reference
}
#[unsafe(export_name = "std_map_len")]
pub extern "C" fn len(reference: i64) -> i64 { with_map(reference, |m| m.len() as i64) }
#[unsafe(export_name = "std_map_is_empty")]
pub extern "C" fn is_empty(reference: i64) -> i64 { with_map(reference, |m| m.is_empty() as i64) }
#[unsafe(export_name = "std_map_contains_key")]
pub extern "C" fn contains_key(reference: i64, key: i32) -> i64 { with_map(reference, |m| m.contains_key(&key) as i64) }
#[unsafe(export_name = "std_map_get")]
pub extern "C" fn get(reference: i64, key: i32) -> i64 { with_map(reference, |m| option(m.get(&key).copied())) }
#[unsafe(export_name = "std_map_insert")]
pub extern "C" fn insert(reference: i64, key: i32, value: i32) -> i64 { with_map_mut(reference, |m| option(m.insert(key, value))) }
#[unsafe(export_name = "std_map_remove")]
pub extern "C" fn remove(reference: i64, key: i32) -> i64 { with_map_mut(reference, |m| option(m.remove(&key))) }
#[unsafe(export_name = "std_map_clear")]
pub extern "C" fn clear(reference: i64) -> i32 {
    MAPS.with_borrow_mut(|maps| match maps.get_mut(&reference) { Some(m) => { m.clear(); 0 }, None => ERR_INVALID_REFERENCE })
}
#[unsafe(export_name = "std_map_drop")]
pub extern "C" fn drop_map(reference: i64) -> i32 {
    MAPS.with_borrow_mut(|maps| {
        if !maps.contains_key(&reference) { return ERR_INVALID_REFERENCE; }
        let status = unsafe { list_drop(reference, token_type()) };
        if status == 0 { maps.remove(&reference); }
        status
    })
}
