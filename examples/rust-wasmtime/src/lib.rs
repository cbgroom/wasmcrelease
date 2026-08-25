use std::{error::Error, fs, path::PathBuf};
use wasmtime::{Engine, Instance, Module, Store};

const SAMPLE: &str = r#"package local:add;
interface api {
  run: func(a: s32, b: s32) -> s32 { return a + b * 2; }
}
world app { export api; }
"#;

fn artifact(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dist").join(name)
}

pub fn exercise() -> Result<(usize, i32), Box<dyn Error>> {
    let engine = Engine::default();
    let compiler_bytes = fs::read(artifact("wasmc_compiler.wasm"))?;
    let compiler = Module::new(&engine, compiler_bytes)?;
    if compiler.imports().next().is_some() {
        return Err("compiler unexpectedly requires host imports".into());
    }

    // The module is reusable; request-local state is not.
    let generated = {
        let mut store = Store::new(&engine, ());
        let instance = Instance::new(&mut store, &compiler, &[])?;
        let alloc = instance.get_typed_func::<i32, i32>(&mut store, "wasmc_alloc")?;
        let compile = instance.get_typed_func::<(i32, i32), i32>(&mut store, "wasmc_compile")?;
        let output_ptr = instance.get_typed_func::<(), i32>(&mut store, "wasmc_output_ptr")?;
        let output_len = instance.get_typed_func::<(), i32>(&mut store, "wasmc_output_len")?;
        let error_ptr = instance.get_typed_func::<(), i32>(&mut store, "wasmc_error_ptr")?;
        let error_len = instance.get_typed_func::<(), i32>(&mut store, "wasmc_error_len")?;
        let clear = instance.get_typed_func::<(), ()>(&mut store, "wasmc_clear")?;
        let memory = instance.get_memory(&mut store, "memory").ok_or("compiler memory missing")?;
        let input = SAMPLE.as_bytes();
        let pointer = alloc.call(&mut store, input.len() as i32)?;
        memory.write(&mut store, pointer as usize, input)?;
        let status = compile.call(&mut store, (pointer, input.len() as i32))?;
        if status != 0 {
            let pointer = error_ptr.call(&mut store, ())? as usize;
            let length = error_len.call(&mut store, ())? as usize;
            let mut message = vec![0; length];
            memory.read(&store, pointer, &mut message)?;
            return Err(String::from_utf8_lossy(&message).into_owned().into());
        }
        let pointer = output_ptr.call(&mut store, ())? as usize;
        let length = output_len.call(&mut store, ())? as usize;
        let mut bytes = vec![0; length];
        memory.read(&store, pointer, &mut bytes)?;
        clear.call(&mut store, ())?;
        bytes
    };

    let result = {
        let app = Module::new(&engine, &generated)?;
        if app.imports().next().is_some() {
            return Err("sample output unexpectedly requires host imports".into());
        }
        let mut store = Store::new(&engine, ());
        let instance = Instance::new(&mut store, &app, &[])?;
        instance.get_typed_func::<(i32, i32), i32>(&mut store, "run")?
            .call(&mut store, (5, 6))?
    };

    let provider_bytes = fs::read(artifact("fastapi_core.wasm"))?;
    let provider = Module::new(&engine, provider_bytes)?;
    if provider.imports().next().is_some() {
        return Err("FastAPI Core unexpectedly requires host imports".into());
    }
    let mut store = Store::new(&engine, ());
    let instance = Instance::new(&mut store, &provider, &[])?;
    let init = instance.get_typed_func::<(i32, i32), i32>(&mut store, "provider_domain_init")?;
    if init.call(&mut store, (1, 1))? != 0 {
        return Err("FastAPI Core initialization failed".into());
    }
    Ok((generated.len(), result))
}

#[cfg(test)]
mod tests {
    #[test]
    fn compiler_and_fastapi_artifacts_execute() {
        let (bytes, result) = super::exercise().unwrap();
        assert_eq!(bytes, 44);
        assert_eq!(result, 17);
    }
}
