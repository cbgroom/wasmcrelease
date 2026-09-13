use std::{fs,error::Error};
use wasmi::{Engine,Linker,Module,Store,Val};
#[test]
fn portable_std_wasmi()->Result<(),Box<dyn Error>> {
    let e=Engine::default();
    let old=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../standard/wasmc-std/1.4.0/artifact.wasm");
    assert!(Module::new(&e,fs::read(old)?).is_err(),"old artifact negative control");
    let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../admission/portable-std-v0");
    let root=root.to_str().ok_or("path")?;
    for file in ["rust.wasm","wasmc.wasm"] {
        let mut s=Store::new(&e,());
        let p=Module::new(&e,fs::read(format!("{root}/../../standard/corelib/4.8.0/corelib.wasm"))?)?;
        let p=Linker::new(&e).instantiate_and_start(&mut s,&p)?;
        assert_eq!(p.get_typed_func::<(i32,i32),i32>(&s,"provider_domain_init")?.call(&mut s,(127,7))?,0);
        let mut l=Linker::new(&e);
        for x in p.exports(&s) {l.define("wasmc:lib/wasmc.lib_managed_object_heap@4.8.0",x.name(),x.into_extern())?;}
        let m=Module::new(&e,fs::read(format!("{root}/package/artifact.wasm"))?)?;
        let lib=l.instantiate_and_start(&mut s,&m)?;
        assert_eq!(lib.get_typed_func::<(),i32>(&s,"std_init")?.call(&mut s,())?,0);
        let mut l=Linker::new(&e);
        for x in lib.exports(&s) {l.define("wasmc:lib/wasmc.std@1.4.1",x.name(),x.into_extern())?;}
        let m=Module::new(&e,fs::read(format!("{root}/{file}"))?)?;
        let a=l.instantiate_and_start(&mut s,&m)?;
        let f=a.get_func(&s,"run").ok_or("run missing")?;
        let n=f.ty(&s).results().len();
        assert!(n==1 || n==2);
        let mut out=vec![Val::I32(0);n];
        let mut calls=0;
        for _ in 0..128 {
            for index in [0u32,1,2,99,u32::MAX] {
                for byte in [0,1,128,255] {
                    f.call(&mut s,&[Val::I32(index as i32),Val::I32(byte)],&mut out)?;
                    let expected=match index {0=>-7,1=>0,2=>i32::MAX,_=>9};
                    assert_eq!(out[0].i32(),Some(expected));
                    if n==2 {assert_eq!(out[1].i32(),Some(0));}
                    calls+=1;
                }
            }
        }
        println!("PASS Wasmi 2 {file}: {calls} calls / 20 vectors / same CoreLib domain");
    }
    Ok(())
}

#[cfg(feature="wasmtime-engine")]
#[test]
fn portable_std_wasmtime()->Result<(),Box<dyn Error>> {
    use wasmtime::{Engine,Linker,Module,Store,Val};
    let e=Engine::default();
    let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../admission/portable-std-v0");
    for file in ["rust.wasm","wasmc.wasm"] {
        let mut s=Store::new(&e,());
        let m=Module::new(&e,fs::read(root.join("../../standard/corelib/4.8.0/corelib.wasm"))?)?;
        let p=Linker::<()>::new(&e).instantiate(&mut s,&m)?;
        assert_eq!(p.get_typed_func::<(i32,i32),i32>(&mut s,"provider_domain_init")?.call(&mut s,(127,7))?,0);
        let mut linker=Linker::new(&e);
        let exports=p.exports(&mut s).map(|x|(x.name().to_owned(),x.into_extern())).collect::<Vec<_>>();
        for (name,value) in exports{linker.define(&mut s,"wasmc:lib/wasmc.lib_managed_object_heap@4.8.0",&name,value)?;}
        let m=Module::new(&e,fs::read(root.join("package/artifact.wasm"))?)?;
        let lib=linker.instantiate(&mut s,&m)?;
        assert_eq!(lib.get_typed_func::<(),i32>(&mut s,"std_init")?.call(&mut s,())?,0);
        let mut linker=Linker::new(&e);
        // Collect before define: export iteration borrows Store mutably.
        let exports=lib.exports(&mut s).map(|x|(x.name().to_owned(),x.into_extern())).collect::<Vec<_>>();
        for (name,value) in exports{linker.define(&mut s,"wasmc:lib/wasmc.std@1.4.1",&name,value)?;}
        let m=Module::new(&e,fs::read(root.join(file))?)?;
        let app=linker.instantiate(&mut s,&m)?;
        let f=app.get_func(&mut s,"run").ok_or("run missing")?;
        let mut out=f.ty(&s).results().map(|ty|Val::default_for_ty(&ty).unwrap()).collect::<Vec<_>>();
        let mut calls=0;
        for _ in 0..128{for index in [0u32,1,2,99,u32::MAX]{for byte in [0,1,128,255]{
            f.call(&mut s,&[Val::I32(index as i32),Val::I32(byte)],&mut out)?;
            assert_eq!(out[0].unwrap_i32(),match index{0=>-7,1=>0,2=>i32::MAX,_=>9});
            if out.len()==2{assert_eq!(out[1].unwrap_i32(),0);}
            calls+=1;
        }}}
        println!("PASS Wasmtime47 {file}: {calls}calls /20vectors /same CoreLib domain");
    }
    Ok(())
}
