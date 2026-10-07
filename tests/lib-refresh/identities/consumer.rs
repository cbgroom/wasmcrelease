use std::{error::Error, fs};
use owned_sdk::{exports::wasmc::owned_algorithms::algorithms::Request, wasmtime};
use wasmtime::{component::{Component, Linker}, Engine, Store};

fn main() -> Result<(), Box<dyn Error>> {
    let paths: Vec<_> = std::env::args().skip(1).collect();
    assert_eq!(paths.len(), 3);
    let mut config = wasmtime::Config::new();
    config.consume_fuel(true);
    let engine = Engine::new(&config)?;
    let owned_component = Component::new(&engine, fs::read(&paths[0])?)?;
    let mut owned_store = Store::new(&engine, ());
    owned_store.set_fuel(u64::MAX)?;
    let owned = owned_sdk::Lib::instantiate(&mut owned_store, &owned_component, &Linker::new(&engine))?;
    let api = owned.wasmc_owned_algorithms_algorithms();
    assert_eq!(api.call_utf8_score(&mut owned_store, "A中")?, 2004);
    assert_eq!(api.call_utf8_score(&mut owned_store, "")?, 0);
    assert_eq!(api.call_utf8_score(&mut owned_store, "😀")?, 1004);
    assert_eq!(api.call_sum_s32(&mut owned_store, &[i32::MIN, i32::MAX, 1])?, 0);
    assert_eq!(api.call_sum_s32(&mut owned_store, &[i32::MAX, i32::MAX])?, 4294967294);
    assert_eq!(api.call_sum_s32(&mut owned_store, &[])?, 0);
    assert_eq!(api.call_count_true(&mut owned_store, &[true, false, true])?, 2);
    assert_eq!(api.call_request_score(&mut owned_store, &Request {
        label: "中".into(), values: vec![4, -5], enabled: true,
    })?, 3099);

    let counter_component = Component::new(&engine, fs::read(&paths[1])?)?;
    let mut counter_store = Store::new(&engine, ());
    counter_store.set_fuel(u64::MAX)?;
    let counter_lib = counter_sdk::Lib::instantiate(&mut counter_store, &counter_component, &Linker::new(&engine))?;
    let counters = counter_lib.wasmc_resource_counter_counters().counter();
    for round in 0..128 {
        let first = counters.call_constructor(&mut counter_store, round)?;
        let second = counters.call_constructor(&mut counter_store, i32::MAX)?;
        assert_eq!(counters.call_add(&mut counter_store, first.clone(), 5)?, round + 5);
        assert_eq!(counters.call_value(&mut counter_store, first.clone())?, round + 5);
        assert_eq!(counters.call_add(&mut counter_store, second.clone(), 1)?, i32::MIN);
        assert_eq!(counters.call_value(&mut counter_store, first.clone())?, round + 5);
        first.resource_drop(&mut counter_store)?;
        second.resource_drop(&mut counter_store)?;
    }
    let stale = counters.call_constructor(&mut counter_store, 9)?;
    stale.clone().resource_drop(&mut counter_store)?;
    assert!(counters.call_value(&mut counter_store, stale).is_err());
    drop(counter_store); // A failed resource access is not recovery evidence.

    let host_component = Component::new(&engine, fs::read(&paths[2])?)?;
    let mut denied_store = Store::new(&engine, ());
    denied_store.set_fuel(u64::MAX)?;
    assert!(Linker::new(&engine).instantiate(&mut denied_store, &host_component).is_err());
    let mut linker = Linker::<(i32, u32)>::new(&engine);
    linker.instance("wasmc:host-clock/clock-host@0.0.2")?
        .func_wrap("now", |mut store: wasmtime::StoreContextMut<'_, (i32,u32)>, (): ()| {
            store.data_mut().1 += 1;
            Ok((store.data().0,))
        })?;
    let mut clock_store = Store::new(&engine, (40, 0));
    clock_store.set_fuel(u64::MAX)?;
    let clock = clock_sdk::Lib::instantiate(&mut clock_store, &host_component, &linker)?;
    let api = clock.wasmc_host_clock_clock_api();
    assert_eq!(api.call_sampled(&mut clock_store, 2)?, 42);
    clock_store.data_mut().0 = i32::MAX;
    assert_eq!(api.call_sampled(&mut clock_store, 1)?, i32::MIN);
    assert_eq!(clock_store.data().1, 2);
    println!("{{\"accepted\":true,\"generated_component_sdks\":3,\"owned_cases\":8,\"counter_resource_rounds\":128,\"counter_resources_dropped\":257,\"stale_resource_rejected\":true,\"missing_host_import_rejected\":true,\"host_calls\":2,\"fuel_diagnostic_only\":true}}");
    Ok(())
}
