use std::{error::Error, fs, path::PathBuf};
use wasmtime::{
    component::{Component, Linker, Val},
    Engine, Instance, Module, Store,
};

const SAMPLE: &str = r#"package local:add;
interface api {
  run: func(a: s32, b: s32) -> s32 { return a + b * 2; }
}
world app { export api; }
"#;

fn release_file(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}

pub fn exercise() -> Result<(usize, i32, i32, i32), Box<dyn Error>> {
    let engine = Engine::default();
    let compiler = Module::new(&engine, fs::read(release_file("dist/wasmc_compiler.wasm"))?)?;
    if compiler.imports().next().is_some() {
        return Err("compiler unexpectedly requires Host imports".into());
    }
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
        if compile.call(&mut store, (pointer, input.len() as i32))? != 0 {
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
    let scalar = {
        let app = Module::new(&engine, &generated)?;
        let mut store = Store::new(&engine, ());
        Instance::new(&mut store, &app, &[])?.get_typed_func::<(i32, i32), i32>(&mut store, "run")?.call(&mut store, (5, 6))?
    };

    let resource = Component::new(&engine, fs::read(release_file("libs/wasmc-resource-counter/component.wasm"))?)?;
    let mut resource_store = Store::new(&engine, ());
    let resource_instance = Linker::new(&engine).instantiate(&mut resource_store, &resource)?;
    let counters = resource.get_export_index(None, "wasmc:resource-counter/counters@0.0.1").ok_or("counter interface missing")?;
    let constructor = resource_instance.get_func(&mut resource_store, &resource.get_export_index(Some(&counters), "[constructor]counter").ok_or("constructor missing")?).ok_or("constructor function missing")?;
    let add = resource_instance.get_func(&mut resource_store, &resource.get_export_index(Some(&counters), "[method]counter.add").ok_or("add missing")?).ok_or("add function missing")?;
    let mut result = [Val::Bool(false)];
    constructor.call(&mut resource_store, &[Val::S32(10)], &mut result)?;
    let counter = match &result[0] { Val::Resource(value) => value.clone(), _ => return Err("constructor did not return a resource".into()) };
    add.call(&mut resource_store, &[Val::Resource(counter.clone()), Val::S32(5)], &mut result)?;
    let counter_value = match result[0] { Val::S32(value) => value, _ => return Err("counter add did not return s32".into()) };
    counter.resource_drop(&mut resource_store)?;

    let host = Component::new(&engine, fs::read(release_file("libs/wasmc-host-clock/component.wasm"))?)?;
    let mut host_linker = Linker::new(&engine);
    host_linker.instance("wasmc:host-clock/clock-host@0.0.1")?.func_wrap("now", |_store, (): ()| Ok((40_i32,)))?;
    let mut host_store = Store::new(&engine, ());
    let host_instance = host_linker.instantiate(&mut host_store, &host)?;
    let clock = host.get_export_index(None, "wasmc:host-clock/clock-api@0.0.1").ok_or("clock interface missing")?;
    let sampled = host_instance.get_func(&mut host_store, &host.get_export_index(Some(&clock), "sampled").ok_or("sampled missing")?).ok_or("sampled function missing")?;
    sampled.call(&mut host_store, &[Val::S32(2)], &mut result)?;
    let sampled_value = match result[0] { Val::S32(value) => value, _ => return Err("sampled did not return s32".into()) };
    Ok((generated.len(), scalar, counter_value, sampled_value))
}

#[cfg(test)]
mod tests {
    #[test]
    fn compiler_resource_and_explicit_host_lib_execute() {
        assert_eq!(super::exercise().unwrap(), (44, 17, 15, 42));
    }
}
