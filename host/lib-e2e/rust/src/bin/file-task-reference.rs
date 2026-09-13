//! Bounded scalar task fixture; real preopened I/O, not a production async reactor.
use std::fs::{File, OpenOptions};
use wasmc_preopened_file_reference::PreopenedFile;

type Failure = Box<dyn std::error::Error>;

macro_rules! backend {
    ($name:ident, $backend:ident, $engine:expr, $instantiate:ident) => {
        mod $name {
            use super::*;
            use $backend::{Config, Engine, Linker, Module, Store};
            pub fn run(app: &str, library: &str, input: &str, output: &str, mode: &str) -> Result<(), Failure> {
                let mut config = Config::default();
                config.consume_fuel(true);
                let engine = ($engine)(&config)?;
                let module = Module::new(&engine, std::fs::read(app)?)?;
                let mut store = Store::new(&engine, ());
                store.set_fuel(100_000)?;
                let instance = Linker::new(&engine).$instantiate(&mut store, &module)?;
                let step = instance.get_typed_func::<(i32,i32,i32),(i32,i32,i32)>(&mut store,"run")?;
                let module = Module::new(&engine, std::fs::read(library)?)?;
                let mut lib_store = Store::new(&engine, ());
                lib_store.set_fuel(100_000)?;
                let lib = Linker::new(&engine).$instantiate(&mut lib_store, &module)?;
                let memory = lib.get_memory(&mut lib_store,"memory").ok_or("missing memory")?;
                let alloc = lib.get_typed_func::<(i32,i32,i32,i32),i32>(&mut lib_store,"cabi_realloc")?;
                let sum = lib.get_typed_func::<(i32,i32),i64>(&mut lib_store,"sum-s32")?;
                let ptr = alloc.call(&mut lib_store,(0,0,4,64))?;
                let result = (|| -> Result<(usize,bool), Failure> {
                    // Paths belong to the trusted CLI harness, never the guest.
                    let mut input = PreopenedFile::new(File::open(input)?,false);
                    let mut output = PreopenedFile::new(OpenOptions::new().write(true).read(true).create_new(true).open(output)?,true);
                    let mut bytes = Vec::new();
                    let (mut state,mut event,mut value) = (0,0,16);
                    let mut effects = 0;
                    for _ in 0..6 {
                        let (disposition,next,payload) = step.call(&mut store,(state,event,value))?;
                        if disposition == 1 && next == 0 && effects == 5 && payload == 8 {
                            return Ok((effects,true));
                        }
                        if disposition != 0 || next != state+1 || !(1..=5).contains(&next) {
                            return Err("invalid task transition".into());
                        }
                        effects += 1;
                        value = match next {
                            1 => {
                                if payload != 16 {return Err("read bound mismatch".into());}
                                bytes = input.read(0,16).map_err(|_| "read failed")?;
                                if mode == "cancel" {return Ok((effects,false));}
                                bytes.len() as i32
                            }
                            2 => {
                                if payload != bytes.len() as i32 {return Err("length mismatch".into());}
                                let mut packed = [0;64];
                                for (i,byte) in bytes.iter().enumerate() {
                                    packed[4*i..4*i+4].copy_from_slice(&i32::from(*byte).to_le_bytes());
                                }
                                memory.write(&mut lib_store,ptr as usize,&packed)?;
                                i32::try_from(sum.call(&mut lib_store,(ptr,payload))?)?
                            }
                            3 => {
                                let expected: i32 = bytes.iter().map(|byte| i32::from(*byte)).sum();
                                if payload != expected {return Err("sum mismatch".into());}
                                output.write(0,&i64::from(payload).to_le_bytes()).map_err(|_| "write failed")? as i32
                            }
                            4 => {
                                if payload != 8 {return Err("write count mismatch".into());}
                                if mode == "sync-failure" {return Ok((effects,false));}
                                output.invoke_sync().map_err(|_| "sync failed")?;
                                payload
                            }
                            5 => {
                                input.release().map_err(|_| "input release failed")?;
                                output.release().map_err(|_| "output release failed")?;
                                payload
                            }
                            _ => unreachable!(),
                        };
                        state = next; event = 1;
                    }
                    Err("task transition limit".into())
                })();
                memory.write(&mut lib_store,ptr as usize,&[0;64])?;
                lib_store.set_fuel(100_000)?;
                alloc.call(&mut lib_store,(ptr,64,4,0))?;
                let (effects,completed) = result?;
                println!("{{\"accepted\":true,\"effects\":{effects},\"completed\":{completed},\"scratch_released\":true,\"blocking_io_fixture\":true,\"os_abort_proven\":false}}");
                Ok(())
            }
        }
    }
}
backend!(
    interpreter,
    wasmi,
    |c| Ok::<_, wasmi::Error>(Engine::new(c)),
    instantiate_and_start
);
#[cfg(feature = "wasmtime-engine")]
backend!(jit, wasmtime, Engine::new, instantiate);

fn main() -> Result<(), Failure> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 7 || !["normal", "cancel", "sync-failure"].contains(&args[6].as_str()) {
        return Err("usage: file-task-reference APP LIB INPUT OUTPUT wasmi|wasmtime normal|cancel|sync-failure".into());
    }
    match args[5].as_str() {
        "wasmi" => interpreter::run(&args[1], &args[2], &args[3], &args[4], &args[6]),
        #[cfg(feature = "wasmtime-engine")]
        "wasmtime" => jit::run(&args[1], &args[2], &args[3], &args[4], &args[6]),
        _ => Err("unsupported engine".into()),
    }
}
