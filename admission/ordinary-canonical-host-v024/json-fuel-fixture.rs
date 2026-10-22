//! Pure Host fixture for an already sealed ordinary HTTP + JSON + Table Guest.
//! No compiler, network, database, publication or real transaction is invoked.
//! Usage: json-fuel-fixture ARTIFACT CALLER_PLAN [EXPECTED_ARTIFACT_SHA256]
use serde_json::{json, Value};
use std::{collections::BTreeMap, fs, time::Instant};

const FUEL: u64 = 10_000_000;
const MEMORY: usize = 64 * 1024 * 1024;
#[derive(Default)]
struct Inputs {
    body: Vec<u8>, calls: usize, responses: Vec<(i32, Vec<u8>)>,
    raw_calls: usize, rows: BTreeMap<String, Value>, error: Option<(i32, Vec<u8>)>,
    drops: usize, host_entry_remaining_fuel: Option<u64>, response_remaining_fuel: Option<u64>,
    mode: i32, shape: Value, limits: wasmtime::StoreLimits,
}
fn pairs(base: u32, values: &[(Vec<u8>, Vec<u8>)]) -> Vec<u8> {
    let mut out = vec![0; 8 + 16 * values.len()];
    fn put(out: &mut [u8], at: usize, n: u32) { out[at..at+4].copy_from_slice(&n.to_le_bytes()); }
    put(&mut out, 0, base+8); put(&mut out, 4, values.len() as u32);
    for (i, (name, value)) in values.iter().enumerate() {
        for (at, data) in [(8+i*16, name), (16+i*16, value)] {
            let p = base + out.len() as u32;
            put(&mut out, at, p); put(&mut out, at+4, data.len() as u32); out.extend_from_slice(data);
        }
    }
    out
}
impl Inputs {
    fn field(&self, index: usize, base: u32) -> Vec<u8> { match index {
        0 => b"POST".to_vec(), 1 => b"/ordinary-json".to_vec(),
        2 | 3 => pairs(base, &[]),
        4 => pairs(base, &[(b"content-type".to_vec(), b"application/json".to_vec())]),
        5 => self.body.clone(), _ => unreachable!(),
    }}
    fn charge(&mut self) { self.calls += 1; assert!(self.calls <= 64, "Host call budget"); }
}
fn decode(s: &Value, p: u32, bytes: &[u8], base: u32, len: u32) -> Value {
    let range = |p: u32, n: u32| {
        assert!(p >= base && p as u64+n as u64 <= base as u64+len as u64);
        &bytes[p as usize..p as usize+n as usize]
    };
    let word = |p| u32::from_le_bytes(range(p,4).try_into().unwrap());
    let n = s["size"].as_u64().unwrap() as u32; range(p,n);
    match s["kind"].as_str().unwrap() {
        "unit" => Value::Null,
        "scalar" => {let mut b=[0u8;8]; b[..n as usize].copy_from_slice(range(p,n)); json!(u64::from_le_bytes(b))},
        "string" => json!(std::str::from_utf8(range(word(p),word(p+4))).unwrap()),
        "record" => s["fields"].as_array().unwrap().iter().map(|f| (f["name"].as_str().unwrap().to_owned(),
            decode(&f["value"],p+f["offset"].as_u64().unwrap() as u32,bytes,base,len))).collect(),
        "list" => {let e=&s["element"]; let q=word(p); let count=word(p+4); let stride=e["size"].as_u64().unwrap() as u32;
            range(q,count.checked_mul(stride).unwrap()); (0..count).map(|i|decode(e,q+i*stride,bytes,base,len)).collect()},
        kind @ ("option" | "variant" | "result") => {
            let mut b=[0u8;4]; let n=s["tag_size"].as_u64().unwrap() as u32;
            b[..n as usize].copy_from_slice(range(p,n)); let tag=u32::from_le_bytes(b);
            let v=decode(&s["cases"][tag as usize],p+s["payload_offset"].as_u64().unwrap() as u32,bytes,base,len);
            if kind=="option" {if tag==0 {Value::Null} else {v}} else {json!({"tag":tag,"value":v})}
        }, other => panic!("unsupported exact Canonical shape {other}"),
    }
}
fn digest(path: &str) -> String {
    let output=std::process::Command::new("sha256sum").arg(path).output().unwrap();
    assert!(output.status.success()); String::from_utf8(output.stdout).unwrap().split_whitespace().next().unwrap().to_owned()
}
fn request(value: Value, allow: bool) -> Vec<u8> {
    // Synthetic fixture identifiers: this data is never submitted to a real Host.
    serde_json::to_vec(&json!({"allow":allow,"value":value,
        "key":"01000000-0000-4000-8000-000000000001", "second_key":"01000000-0000-4000-8000-000000000002",
        "revision":"1111111111111111111111111111111111111111",
        "txid":"02000000-0000-4000-8000-000000000001",
        "operation_id":"03000000-0000-4000-8000-000000000001",
        "second_operation_id":"03000000-0000-4000-8000-000000000002"})).unwrap()
}
fn main() {
    let args=std::env::args().collect::<Vec<_>>(); assert!((3..=4).contains(&args.len()));
    let artifact_sha=digest(&args[1]); if let Some(expected)=args.get(3) {assert_eq!(&artifact_sha,expected);}
    let plan: Value=serde_json::from_slice(&fs::read(&args[2]).unwrap()).unwrap();
    let shape=plan["native_host_projection"][0]["argument_shape"].clone(); assert!(shape.is_object());
    assert_eq!(plan["corelib_sha256"],"c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00");
    let mut config=wasmtime::Config::new(); config.consume_fuel(true);
    let engine=wasmtime::Engine::new(&config).unwrap(); let module=wasmtime::Module::from_file(&engine,&args[1]).unwrap();
    assert_eq!(module.imports().count(),18);
    let mut linker=wasmtime::Linker::<Inputs>::new(&engine);
    for (index,name) in ["method","path","parameters","query","headers","body"].iter().enumerate() {
        linker.func_wrap("mcpgit:http/v1",&format!("request-{name}-len"),move |mut c:wasmtime::Caller<'_,Inputs>| -> i32 {
            c.data_mut().charge(); c.data().field(index,0).len() as i32
        }).unwrap();
        linker.func_wrap("mcpgit:http/v1",&format!("request-{name}-read"),move |mut c:wasmtime::Caller<'_,Inputs>,offset:i32,p:i32,n:i32| -> i32 {
            c.data_mut().charge(); assert_eq!(offset,0); let bytes=c.data().field(index,p as u32); assert_eq!(n as usize,bytes.len());
            let m=c.get_export("memory").unwrap().into_memory().unwrap(); m.write(&mut c,p as usize,&bytes).unwrap(); n
        }).unwrap();
    }
    linker.func_wrap("mcpgit:http/v1","response-canonical-write",|mut c:wasmtime::Caller<'_,Inputs>,status:i32,p:i32,n:i32| -> i32 {
        c.data_mut().charge(); let fuel=c.get_fuel().unwrap(); c.data_mut().response_remaining_fuel=Some(fuel);
        let m=c.get_export("memory").unwrap().into_memory().unwrap(); let body=m.data(&c)[p as usize..p as usize+n as usize].to_vec();
        c.data_mut().responses.push((status,body)); 0
    }).unwrap();
    linker.func_wrap("mcpgit:lib/v1","wit-table-transact",|mut c:wasmtime::Caller<'_,Inputs>,p:i32,n:i32| -> (i32,i32) {
        c.data_mut().charge(); c.data_mut().raw_calls+=1; let fuel=c.get_fuel().unwrap(); c.data_mut().host_entry_remaining_fuel=Some(fuel);
        let m=c.get_export("memory").unwrap().into_memory().unwrap();
        let txn=decode(&c.data().shape,p as u32,m.data(&c),p as u32,n as u32);
        let operations=txn["operations"].as_array().unwrap(); assert_eq!(operations.len(),2);
        let source:Value=serde_json::from_slice(&c.data().body).unwrap(); let mut candidate=c.data().rows.clone();
        for op in operations {assert_eq!(op["tag"],0); let v=&op["value"]; let row:Value=serde_json::from_str(v["row-json"].as_str().unwrap()).unwrap();
            assert_eq!(row,source,"complete Guest-produced row payload"); candidate.insert(v["key"].as_str().unwrap().into(),row);}
        if c.data().mode<0 {c.data_mut().rows=candidate; (0,0)} else {
            assert!(c.data().error.is_none()); let case=c.data().mode;
            c.data_mut().error=Some((case,format!("pure fixture error case {case}: 雪").into_bytes())); (0,77)
        }
    }).unwrap();
    linker.func_wrap("mcpgit:lib-error/v1","error-case",|mut c:wasmtime::Caller<'_,Inputs>,h:i32| -> i32 {
        c.data_mut().charge(); assert_eq!(h,77); c.data().error.as_ref().unwrap().0
    }).unwrap();
    linker.func_wrap("mcpgit:lib-error/v1","error-message-len",|mut c:wasmtime::Caller<'_,Inputs>,h:i32| -> i32 {
        c.data_mut().charge(); assert_eq!(h,77); c.data().error.as_ref().unwrap().1.len() as i32
    }).unwrap();
    linker.func_wrap("mcpgit:lib-error/v1","error-message-read",|mut c:wasmtime::Caller<'_,Inputs>,h:i32,p:i32,n:i32| -> i32 {
        c.data_mut().charge(); assert_eq!(h,77); let bytes=c.data().error.as_ref().unwrap().1.clone(); assert_eq!(n as usize,bytes.len());
        let m=c.get_export("memory").unwrap().into_memory().unwrap(); m.write(&mut c,p as usize,&bytes).unwrap(); 0
    }).unwrap();
    linker.func_wrap("mcpgit:lib-error/v1","error-drop",|mut c:wasmtime::Caller<'_,Inputs>,h:i32| -> i32 {
        c.data_mut().charge(); assert_eq!(h,77); assert!(c.data_mut().error.take().is_some()); c.data_mut().drops+=1; 0
    }).unwrap();
    let nested=json!({"customer":"王小明","items":[{"sku":"A","qty":2,"price":12.5}],"note":"quote \" and newline\n","total":25});
    let array=json!(["новый заказ",false,null,{"escaped":"\\\\目录/😀","amount":-0.125}]);
    let mut cases=vec![("minimal-success".to_owned(),request(json!(1),true),-1),
        ("nested-allow-success".into(),request(nested.clone(),true),-1),
        ("nested-allow-false".into(),request(nested.clone(),false),-1),
        ("array-success".into(),request(array.clone(),true),-1),
        ("object-success".into(),request(json!({"recovery":true,"message":"同一产物故障后新请求","n":43}),true),-1)];
    for (label,value) in [("minimal",json!(1)),("array",array),("nested",nested)] {
        for case in [2,3] {cases.push((format!("{label}-error-{case}"),request(value.clone(),true),case));}
    }
    for length in [0,32,64,96,128,256,512,1024] {
        cases.push((format!("ascii-string-{length}"),request(json!("x".repeat(length)),true),-1));
    }
    let mut observations=Vec::new();
    for (label,body,mode) in cases {
        eprintln!("case-start {label}");
        let limits=wasmtime::StoreLimitsBuilder::new().memory_size(MEMORY).table_elements(1024).instances(32).build();
        let state=Inputs{body,shape:shape.clone(),mode,limits,..Default::default()};
        let mut store=wasmtime::Store::new(&engine,state); store.limiter(|s|&mut s.limits); store.set_fuel(FUEL).unwrap();
        let instance=linker.instantiate(&mut store,&module).unwrap(); let init_remaining=store.get_fuel().unwrap();
        let handle=instance.get_typed_func::<(),i32>(&mut store,"handle").unwrap();
        store.set_fuel(FUEL).unwrap(); let started=Instant::now(); let result=handle.call(&mut store,()); let elapsed=started.elapsed().as_secs_f64();
        assert!(elapsed<5.0); let remaining=store.get_fuel().unwrap();
        let error=result.as_ref().err().map(|e|format!("{e:?}"));
        let pending=if result.is_ok() {
            let mut p=Vec::new();
            for export in ["__wasmc_app_input_pending","__wasmc_host_window_pending","__wasmc_value_pending_allocations"] {
                p.push(instance.get_typed_func::<(),i32>(&mut store,export).unwrap().call(&mut store,()).unwrap());
            }
            assert_eq!(p,vec![0,0,0]); assert_eq!(store.data().responses.len(),1); assert!(store.data().error.is_none());
            let source:Value=serde_json::from_slice(&store.data().body).unwrap(); let allowed=source["allow"]==true;
            let status=if !allowed {403} else if mode<0 {200} else {409}; assert_eq!(store.data().responses[0].0,status);
            let expected=if allowed {serde_json::to_vec(&source["value"]).unwrap()} else {Vec::new()};
            assert_eq!(store.data().responses[0].1,expected,"complete response bytes");
            assert_eq!(store.data().rows.len(),if allowed&&mode<0 {2} else {0}); Some(p)
        } else {assert_eq!(remaining,0,"fixture failure must be an actual fuel exhaustion"); None};
        let observation=json!({"label":label,"input_bytes":store.data().body.len(),"mode":mode,
            "completed":result.is_ok(),"result":result.ok(),"error":error,"seconds":elapsed,
            "fuel_used":FUEL-remaining,"initialization_fuel_used":FUEL-init_remaining,
            "raw_Host_entry_remaining_fuel":store.data().host_entry_remaining_fuel,
            "response_remaining_fuel":store.data().response_remaining_fuel,"Host_calls":store.data().calls,
            "raw_Host_calls":store.data().raw_calls,"rows":store.data().rows.len(),"error_drops":store.data().drops,"pending":pending,
            "committed_before_trap":error.is_some()&&!store.data().rows.is_empty()});
        eprintln!("{}",serde_json::to_string(&observation).unwrap()); observations.push(observation);
    }
    println!("{}",serde_json::to_string_pretty(&json!({"schema":"wasmc.pure-json-fuel-fixture/v1",
        "artifact_sha256":artifact_sha,"plan_sha256":digest(&args[2]),"fuel":FUEL,"memory_bytes":MEMORY,
        "Host_call_limit":64,"seconds_limit":5,"effect_scope":"pure local fixture; no actual transactions",
        "observations":observations})).unwrap());
}
