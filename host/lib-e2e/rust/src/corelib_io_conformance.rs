// Included only by the two test-engine modules; no producer implementation.
pub fn proof(
    provider: &str,
    caller: &str,
    directory: &str,
    name: &str,
) -> Result<(), super::Failure> {
    use std::io::{Read, Write};
    let engine = engine()?;
    let module = Module::new(&engine, std::fs::read(provider)?)?;
    if module.imports().next().is_some() {
        return Err("provider imports forbidden".into());
    }
    let mut store = Store::new(&engine, ());
    store.set_fuel(10_000_000)?;
    let heap = instantiate(&Linker::new(&engine), &mut store, &module)?;
    let initialize = heap.get_typed_func::<(i32, i32), i32>(&mut store, "provider_domain_init")?;
    assert_eq!(initialize.call(&mut store, (19, 7))?, 0);
    let type_bytes = heap.get_typed_func::<(), i64>(&mut store, "type_bytes")?;
    let ty = type_bytes.call(&mut store, ())?;
    assert_ne!(ty, 0);
    let allocate = heap.get_typed_func::<i64, i64>(&mut store, "bytes_builder_new")?;
    let push =
        heap.get_typed_func::<(i64, i64, i64, i32), i32>(&mut store, "bytes_builder_push_u64_le")?;
    let finish = heap.get_typed_func::<(i64, i64), i32>(&mut store, "bytes_builder_finish")?;
    let drop_object = heap.get_typed_func::<(i64, i64), i32>(&mut store, "object_drop")?;
    let length = heap.get_typed_func::<(i64, i64), i64>(&mut store, "bytes_len")?;
    let caller_module = Module::new(&engine, std::fs::read(caller)?)?;
    for import in caller_module.imports() {
        if import.module() != "heap"
            || !["type_bytes", "bytes_len", "bytes_byte_at"].contains(&import.name())
        {
            return Err("caller import denied".into());
        }
    }
    let mut linker = Linker::new(&engine);
    linker.instance(&mut store, "heap", heap)?;
    let app = instantiate(&linker, &mut store, &caller_module)?;
    let run = app.get_typed_func::<(i64, i32), i64>(&mut store, "run")?;
    let mut poisoned = false;
    let mut calls = 0usize;
    let dispatch = |store: &mut Store<()>,
                    reference: i64,
                    fail: i32,
                    poisoned: &mut bool,
                    calls: &mut usize|
     -> Result<i64, super::Failure> {
        if *poisoned {
            return Err("caller poisoned".into());
        }
        *poisoned = true;
        *calls += 1;
        store.set_fuel(100_000)?;
        let value = run.call(store, (reference, fail))?;
        *poisoned = false;
        Ok(value)
    };
    let mut results = Vec::new();
    for i in 0..4 {
        let input = format!("{directory}/{name}-{i}.input");
        let output = format!("{directory}/{name}-{i}.output");
        let mut bytes = Vec::new();
        {
            let file = std::fs::File::open(input)?;
            file.take(17).read_to_end(&mut bytes)?;
        }
        if bytes.len() > 16 {
            return Err("input budget".into());
        }
        store.set_fuel(100_000)?;
        let reference = allocate.call(&mut store, ty)?;
        assert_ne!(reference, 0);
        for chunk in bytes.chunks(8) {
            let mut packed = [0u8; 8];
            packed[..chunk.len()].copy_from_slice(chunk);
            assert_eq!(
                push.call(
                    &mut store,
                    (
                        reference,
                        ty,
                        i64::from_le_bytes(packed),
                        chunk.len() as i32
                    )
                )?,
                0
            );
        }
        assert_eq!(finish.call(&mut store, (reference, ty))?, 0);
        store.set_fuel(100_000)?;
        let value = dispatch(&mut store, reference, 0, &mut poisoned, &mut calls);
        // Reviewed App only reads, has no async borrow: after synchronous return
        // or trap the Core object can be dropped. No arbitrary pending I/O claim.
        store.set_fuel(100_000)?;
        assert_eq!(drop_object.call(&mut store, (reference, ty))?, 0);
        assert_ne!((length.call(&mut store, (reference, ty))? as u64) >> 32, 0);
        let value = value?;
        assert_eq!(value, bytes.iter().map(|b| i64::from(*b)).sum::<i64>());
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)?;
        file.write_all(&value.to_le_bytes())?;
        file.sync_all()?;
        results.push(value);
    }
    store.set_fuel(100_000)?;
    let reference = allocate.call(&mut store, ty)?;
    assert_ne!(reference, 0);
    assert_eq!(finish.call(&mut store, (reference, ty))?, 0);
    store.set_fuel(100_000)?;
    assert!(dispatch(&mut store, reference, 1, &mut poisoned, &mut calls).is_err());
    assert!(poisoned);
    let before = calls;
    assert!(dispatch(&mut store, reference, 0, &mut poisoned, &mut calls).is_err());
    assert_eq!(calls, before);
    assert_eq!(calls, 5);
    store.set_fuel(100_000)?;
    assert_eq!(drop_object.call(&mut store, (reference, ty))?, 0);
    assert_ne!((length.call(&mut store, (reference, ty))? as u64) >> 32, 0);
    println!("{{\"accepted\":true,\"real_file_io\":true,\"results\":{results:?},\"trap_cleanup\":true,\"stale_rejected\":true,\"post_trap_no_replay\":true,\"caller_scope\":\"reviewed_private_abi_conformance_only\",\"copy_profile\":true}}");
    Ok(())
}
