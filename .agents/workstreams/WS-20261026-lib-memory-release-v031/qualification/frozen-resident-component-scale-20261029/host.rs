use mcpgit_resident_memory_component::{ResidentMemory, wasmtime::{Engine,Store,component::{Component,Linker}}};
use mcpgit_resident_memory_component::exports::mcpgit::resident_memory::memory::{HistoryPolicy,AggregateInput,ObjectInput,ErrorCode};
fn main() -> Result<(),Box<dyn std::error::Error>> {
    let engine=Engine::default();
    let component=Component::from_file(&engine,std::env::args().nth(1).ok_or("missing component")?)?;
    let mut store=Store::new(&engine,());
    let linker=Linker::<()>::new(&engine);
    let bindings=ResidentMemory::instantiate(&mut store,&component,&linker)?;
    let mem=bindings.mcpgit_resident_memory_memory();
    let history=HistoryPolicy {max_retained_generations:4,max_reflog_entries:8,max_refs:8};
    let size=16*1024*1024+1;
    let aggregates=[AggregateInput {key:"item".into(),row_version:1,aggregate_version:"aggregate-v1".into(),objects:vec![ObjectInput {locator:"object".into(),role:None,media_type:"application/octet-stream".into(),mode:"file".into(),object_version:"object-v1".into(),content:vec![42;size]}]}];
    let small=mem.store().call_open(&mut store,&[1u8;20],&aggregates,1024*1024,history)?;
    let err=small.err().ok_or("small budget unexpectedly accepted")?;
    assert!(matches!(err.code,ErrorCode::BudgetExceeded));
    let store_handle=mem.store().call_open(&mut store,&[1u8;20],&aggregates,128*1024*1024,history)?.map_err(|e|format!("{e:?}"))?;
    let budget=mem.store().call_budget(&mut store,store_handle)?;
    assert_eq!(budget.limit_bytes,128*1024*1024);assert!(budget.used_bytes>0&&budget.used_bytes<=budget.limit_bytes);
    let snapshot=mem.store().call_pin_current(&mut store,store_handle)?.map_err(|e|format!("{e:?}"))?;
    let result=mem.snapshot().call_read(&mut store,snapshot,"item","object","object-v1",None)?.map_err(|e|format!("{e:?}"))?;
    assert_eq!(result.bytes.len(),size);assert!(result.bytes.iter().all(|&b|b==42));
    snapshot.resource_drop(&mut store)?;store_handle.resource_drop(&mut store)?;
    println!("PASS installed resident Component: bytes={size}, budget={}, used={}, rejection and recovery",budget.limit_bytes,budget.used_bytes);
    Ok(())
}
