use std::{fs::OpenOptions, path::Path};
use wasmc_preopened_file_reference::PreopenedFile;
use wasmi::{Config, Engine, Linker, Module, Store};

fn run(args: &[String]) -> Result<i64, Box<dyn std::error::Error>> {
    let mut input = PreopenedFile::new(OpenOptions::new().read(true).open(&args[1])?, false);
    let bytes = input.read(0, 16).map_err(|c| format!("read {c}"))?;
    input.release().map_err(|c| format!("release {c}"))?;
    let mut config = Config::default();
    config.consume_fuel(true);
    let engine = Engine::new(&config);
    let lib_module = Module::new(&engine, std::fs::read(Path::new(&args[4]))?)?;
    let mut lib_store = Store::new(&engine, ());
    lib_store.set_fuel(10_000_000)?;
    let lib = Linker::new(&engine).instantiate_and_start(&mut lib_store, &lib_module)?;
    let alloc = lib.get_typed_func::<(i32, i32, i32, i32), i32>(&lib_store, "cabi_realloc")?;
    let sum = lib.get_typed_func::<(i32, i32), i64>(&lib_store, "sum-s32")?;
    let memory = lib
        .get_memory(&lib_store, "memory")
        .ok_or("memory missing")?;
    let ptr = alloc.call(&mut lib_store, (0, 0, 4, 64))?;
    let packed: Vec<u8> = bytes
        .iter()
        .flat_map(|b| i32::from(*b).to_le_bytes())
        .collect();
    memory.write(&mut lib_store, ptr as usize, &packed)?;
    let length = bytes.len() as i32;
    let lib_store = std::sync::Mutex::new(lib_store);
    let mut linker = Linker::new(&engine);
    linker.func_wrap("transport", "sum_window", move |n: i32| -> i64 {
        assert_eq!(n, length);
        sum.call(
            &mut *lib_store.lock().expect("exclusive Lib Store"),
            (ptr, n),
        )
        .expect("reviewed Lib call")
    })?;
    let module = Module::new(&engine, std::fs::read(&args[3])?)?;
    let mut store = Store::new(&engine, ());
    store.set_fuel(100_000)?;
    let app = linker.instantiate_and_start(&mut store, &module)?;
    let value = app
        .get_typed_func::<(i32, i32), i64>(&store, "run")?
        .call(&mut store, (length, args[6].parse()?))?;
    // No output authority is exercised before successful guest completion.
    let mut output = PreopenedFile::new(
        OpenOptions::new().read(true).write(true).open(&args[2])?,
        args[5] == "write",
    );
    let result = output
        .write(0, &value.to_le_bytes())
        .and_then(|_| output.invoke_sync());
    output.release().map_err(|c| format!("release {c}"))?;
    result.map_err(|c| format!("write/sync {c}"))?;
    Ok(value)
}
fn main() {
    match run(&std::env::args().collect::<Vec<_>>()) {
        Ok(value) => println!("{value}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
