use mcpgit_resident_memory_component::{ResidentMemory, wasmtime::{Engine,Store,component::{Component,Linker}}};
use mcpgit_resident_memory_component::exports::mcpgit::resident_memory::memory::{HistoryPolicy,AggregateInput,ObjectInput,ErrorCode,AggregateChange,ObjectMutation,ReplaceRange,ByteRange};
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
    let change=AggregateChange {key:"item".into(),row_version:2,aggregate_version:"aggregate-v2".into(),deleted:false,objects:vec![ObjectMutation::Patch(ReplaceRange {locator:"object".into(),expected_object_version:"object-v1".into(),next_object_version:"object-v2".into(),offset:2,delete_length:2,expected_slice_digest:None,data:vec![7,8,9]})]};
    let next=mem.store().call_publish(&mut store,store_handle,&[1u8;20],&[2u8;20],2,&[change])?.map_err(|e|format!("{e:?}"))?;
    let old=mem.snapshot().call_read(&mut store,snapshot,"item","object","object-v1",Some(ByteRange{start:1,end:5}))?.map_err(|e|format!("{e:?}"))?;
    let new=mem.snapshot().call_read(&mut store,next,"item","object","object-v2",Some(ByteRange{start:1,end:6}))?.map_err(|e|format!("{e:?}"))?;
    assert_eq!(old.bytes,vec![42,42,42,42]);assert_eq!(new.bytes,vec![42,7,8,9,42]);
    let stale=mem.store().call_publish(&mut store,store_handle,&[1u8;20],&[3u8;20],3,&[])?;
    assert!(matches!(stale.err().ok_or("stale parent accepted")?.code,ErrorCode::Conflict));
    next.resource_drop(&mut store)?;snapshot.resource_drop(&mut store)?;store_handle.resource_drop(&mut store)?;
    println!("PASS candidate resident Component: bytes={size}, budget={}, used={}, snapshot patch and conflict recovery",budget.limit_bytes,budget.used_bytes);
    Ok(())
}
