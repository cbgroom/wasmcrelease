use std::fs;

#[test]
fn ordinary_simultaneous_many_records_compile_and_run_on_both_engines() {
    let declarations = (0..140).map(|i| format!("record Rec{i} {{ v{i}: s32 }} ")).collect::<String>();
    let locals = (0..140).map(|i| format!("let p{i}:Rec{i}={{v{i}:a}}; ")).collect::<String>();
    let additions = (0..140).map(|i| format!(" + p{i}.v{i}")).collect::<String>();
    let source = format!("package local:many_records; interface api {{ {declarations} run: func(a:s32,b:s32)->s32 {{ {locals} return 0 {additions} + b; }} }} world app {{export api;}}");
    let provider = fs::read(std::env::var("WASMC_AGGREGATE_INIT_PROVIDER").unwrap()).unwrap();
    assert_eq!(wasmc::self_bundle::hex(&wasmc::self_bundle::sha256(&provider)), "8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e");
    for (name, wasm) in [("compile", wasmc::compile(&source)), ("compile_lib_auto", wasmc::compile_lib_auto(&source))] {
        let wasm = wasm.unwrap_or_else(|error| panic!("{name}: {error}"));
        wasmparser::Validator::new().validate_all(&wasm).unwrap();
        let engine = wasmtime::Engine::default();
        let core = wasmtime::Module::new(&engine, &provider).unwrap();
        let module = wasmtime::Module::new(&engine, &wasm).unwrap();
        let mut store = wasmtime::Store::new(&engine, ());
        let p = wasmtime::Instance::new(&mut store, &core, &[]).unwrap();
        assert_eq!(p.get_typed_func::<(i32,u32),i32>(&mut store,"provider_domain_init").unwrap().call(&mut store,(127,17)).unwrap(),0);
        let mut linker = wasmtime::Linker::new(&engine);
        for import in module.imports() { let f=p.get_func(&mut store,import.name()).unwrap(); linker.define(&mut store,import.module(),import.name(),f).unwrap(); }
        let app = linker.instantiate(&mut store,&module).unwrap();
        if let Ok(init)=app.get_typed_func::<(),i32>(&mut store,"__wasmc_managed_init") { assert_eq!(init.call(&mut store,()).unwrap(),0); }
        let run = app.get_typed_func::<(i32,i32),i32>(&mut store,"run").unwrap();
        let e = wasmi::Engine::default();
        let core2=wasmi::Module::new(&e,provider.as_slice()).unwrap(); let module2=wasmi::Module::new(&e,wasm.as_slice()).unwrap(); let mut store2=wasmi::Store::new(&e,());
        let p2=wasmi::Linker::new(&e).instantiate_and_start(&mut store2,&core2).unwrap();
        assert_eq!(p2.get_typed_func::<(i32,u32),i32>(&store2,"provider_domain_init").unwrap().call(&mut store2,(127,19)).unwrap(),0);
        let mut link2=wasmi::Linker::new(&e); for import in module2.imports(){link2.define(import.module(),import.name(),p2.get_func(&store2,import.name()).unwrap()).unwrap();}
        let app2=link2.instantiate_and_start(&mut store2,&module2).unwrap();
        if let Ok(init)=app2.get_typed_func::<(),i32>(&store2,"__wasmc_managed_init"){assert_eq!(init.call(&mut store2,()).unwrap(),0);}
        let run2=app2.get_typed_func::<(i32,i32),i32>(&store2,"run").unwrap();
        for n in 0..160 {let a=n-80; let b=n*3; assert_eq!(run.call(&mut store,(a,b)).unwrap(),a*140+b);assert_eq!(run2.call(&mut store2,(a,b)).unwrap(),a*140+b);}
        eprintln!("MANY_RECORD_ORDINARY api={name} declarations=140 simultaneously_used=140 calls_per_engine=160 provider=corelib4.12-candidate");
    }
}
