use serde_json::Value;
#[cfg(feature = "wasmtime-engine")]
mod wasmtime_profile;
use std::{
    collections::BTreeMap,
    io::{self, Read},
};
struct Window {
    data: Vec<i64>,
    length: usize,
    busy: bool,
}
struct Operation {
    window: i64,
    data: Vec<i64>,
    state: u8,
}
#[derive(Default)]
struct Host {
    windows: BTreeMap<i64, Window>,
    ops: BTreeMap<i64, Operation>,
    next: i64,
    bytes: Vec<i64>,
}
impl Host {
    fn step(&mut self, name: &str, a: i64, b: i64) -> i64 {
        match name {
            "describe" => match a {
                1 => 3,
                2 => 1,
                _ => -1,
            },
            "window_acquire" => {
                if !(0..=16).contains(&a) || self.windows.len() >= 8 {
                    return -3;
                }
                let token = self.next;
                self.next += 1;
                self.windows.insert(
                    token,
                    Window {
                        data: vec![42; a as usize],
                        length: 0,
                        busy: false,
                    },
                );
                token
            }
            "window_commit" => {
                let Some(w) = self.windows.get_mut(&a) else {
                    return -1;
                };
                if w.busy {
                    return -4;
                }
                if b < 0 || b as usize > w.data.len() {
                    return -5;
                }
                w.length = b as usize;
                0
            }
            "invoke" => {
                if a != 1 && a != 2 {
                    return -1;
                }
                if a == 2 {
                    return -2;
                }
                let Some(w) = self.windows.get_mut(&b) else {
                    return -1;
                };
                if w.busy {
                    return -4;
                }
                if self.ops.len() >= 8 {
                    return -3;
                }
                w.busy = true;
                let token = self.next;
                self.next += 1;
                self.ops.insert(
                    token,
                    Operation {
                        window: b,
                        data: w.data[..w.length].to_vec(),
                        state: 0,
                    },
                );
                token
            }
            "wait" => {
                let Some(op) = self.ops.get_mut(&a) else {
                    return -1;
                };
                if op.state == 2 {
                    return -6;
                }
                if op.state == 0 {
                    self.bytes.clone_from(&op.data);
                    op.state = 1;
                    self.windows.get_mut(&op.window).unwrap().busy = false;
                }
                op.data.len() as i64
            }
            "cancel" => {
                let Some(op) = self.ops.get_mut(&a) else {
                    return -1;
                };
                if op.state != 0 {
                    return -4;
                }
                op.state = 2;
                self.windows.get_mut(&op.window).unwrap().busy = false;
                0
            }
            "release" => {
                if !self.windows.contains_key(&a) && !self.ops.contains_key(&a) {
                    return -1;
                }
                if self.windows.get(&a).is_some_and(|w| w.busy)
                    || self.ops.get(&a).is_some_and(|o| o.state == 0)
                {
                    return -4;
                }
                self.windows.remove(&a);
                self.ops.remove(&a);
                0
            }
            _ => -7,
        }
    }
}
fn main() {
    if let Some(path) = std::env::args().nth(1) {
        if std::env::args().any(|arg| arg == "--wasmtime") {
            #[cfg(feature = "wasmtime-engine")]
            {
                println!(
                    "{}",
                    serde_json::to_string(&wasmtime_profile::run(&path)).unwrap()
                );
                return;
            }
            #[cfg(not(feature = "wasmtime-engine"))]
            {
                eprintln!("optional Wasmtime profile unavailable");
                std::process::exit(2);
            }
        }
        use wasmi::{Caller, Config, Engine, Linker, Module, Store};
        let mut config = Config::default();
        config.consume_fuel(true);
        let engine = Engine::new(&config);
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
                        caller.data_mut().step(name, a as i64, b as i64) as i32
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
        let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
        let run = instance.get_typed_func::<i32, i32>(&store, "run").unwrap();
        let mut rows = Vec::new();
        for size in [0, 1, 4, 16] {
            store.set_fuel(100_000).unwrap();
            let result = run.call(&mut store, size).unwrap();
            let mut row = vec![
                result as i64,
                store.data().windows.len() as i64,
                store.data().ops.len() as i64,
            ];
            row.extend(&store.data().bytes);
            rows.push(row);
        }
        println!("{}", serde_json::to_string(&rows).unwrap());
        return;
    }
    let mut input = String::new();
    io::stdin()
        .take(1024 * 1024)
        .read_to_string(&mut input)
        .unwrap();
    let scenarios: Vec<Vec<Vec<Value>>> = serde_json::from_str(&input).unwrap();
    let mut traces = Vec::new();
    for steps in scenarios {
        let mut host = Host {
            next: 100,
            ..Host::default()
        };
        let mut trace = Vec::new();
        for step in steps {
            let name = step[0].as_str().unwrap();
            let a = step.get(1).map(|v| v.as_i64().unwrap()).unwrap_or(0);
            let b = step.get(2).map(|v| v.as_i64().unwrap()).unwrap_or(0);
            let result = host.step(name, a, b);
            let mut row = vec![result, host.windows.len() as i64, host.ops.len() as i64];
            row.extend(&host.bytes);
            trace.push(row);
        }
        traces.push(trace);
    }
    println!("{}", serde_json::to_string(&traces).unwrap());
}
