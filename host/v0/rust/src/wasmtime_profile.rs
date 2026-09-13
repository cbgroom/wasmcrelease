use super::Host;
use wasmtime::{Caller, Config, Engine, Linker, Module, Store};

pub fn run(path: &str) -> Vec<Vec<i64>> {
    let mut config = Config::new();
    config.consume_fuel(true);
    let engine = Engine::new(&config).unwrap();
    let module = Module::new(&engine, std::fs::read(path).unwrap()).unwrap();
    let mut linker = Linker::new(&engine);
    for name in [
        "describe",
        "window_acquire",
        "window_commit",
        "invoke",
        "wait",
        "cancel",
        "release",
    ] {
        linker
            .func_wrap(
                "host",
                name,
                move |mut caller: Caller<Host>, a: i32, b: i32| {
                    caller.data_mut().step(name, i64::from(a), i64::from(b)) as i32
                },
            )
            .unwrap();
    }
    let mut store = Store::new(
        &engine,
        Host {
            next: 100,
            ..Host::default()
        },
    );
    store.set_fuel(100_000).unwrap();
    let instance = linker.instantiate(&mut store, &module).unwrap();
    let run = instance
        .get_typed_func::<i32, i32>(&mut store, "run")
        .unwrap();
    let mut rows = Vec::new();
    for size in [0, 1, 4, 16] {
        store.set_fuel(100_000).unwrap();
        let result = run.call(&mut store, size).unwrap();
        let mut row = vec![
            i64::from(result),
            store.data().windows.len() as i64,
            store.data().ops.len() as i64,
        ];
        row.extend(&store.data().bytes);
        rows.push(row);
    }
    rows
}
