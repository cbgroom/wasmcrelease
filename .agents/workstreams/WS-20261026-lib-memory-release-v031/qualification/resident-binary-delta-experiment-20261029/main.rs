mod resident_state;
mod baseline; mod candidate;
macro_rules! run {
 ($m:ident,$content:expr,$budget:expr) => {{
  let object=$m::ObjectInput {locator:"object".into(),role:Some("original".into()),media_type:"application/octet-stream".into(),mode:"file".into(),object_version:"v1".into(),content:$content.clone()};
  let history=$m::HistoryPolicy{max_retained_generations:4,max_reflog_entries:8,max_refs:8};
  let aggregate=$m::AggregateInput{key:"item".into(),row_version:1,aggregate_version:"a1".into(),objects:vec![object]};
  let store=$m::Store::open(vec![1;20],vec![aggregate],$budget,history).map_err(|e|format!("{:?}: {}",e.code,e.message))?;
  let initial=store.budget().used_bytes;
  let snapshot=store.pin_current().map_err(|e|format!("{e:?}"))?;
  let read=snapshot.read("item".into(),"object".into(),"v1".into(),None).map_err(|e|format!("{e:?}"))?;
  assert_eq!(read.bytes,$content);assert_eq!(read.total_bytes,$content.len() as u64);
  let changed=$m::AggregateChange{key:"item".into(),row_version:2,aggregate_version:"a2".into(),deleted:false,objects:vec![$m::ObjectMutation::Patch($m::ReplaceRange{locator:"object".into(),expected_object_version:"v1".into(),next_object_version:"v2".into(),offset:2,delete_length:2,expected_slice_digest:None,data:vec![7,8,9]})]};
  let next=store.publish(vec![1;20],vec![2;20],2,vec![changed]).map_err(|e|format!("{e:?}"))?;
  let old=snapshot.read("item".into(),"object".into(),"v1".into(),Some($m::ByteRange{start:1,end:5})).map_err(|e|format!("{e:?}"))?;
  let now=next.read("item".into(),"object".into(),"v2".into(),Some($m::ByteRange{start:1,end:6})).map_err(|e|format!("{e:?}"))?;
  assert_eq!(old.bytes,vec![42,42,42,42]);assert_eq!(now.bytes,vec![42,7,8,9,42]);
  assert_eq!(format!("{:?}",next.read("item".into(),"object".into(),"wrong".into(),None).err().unwrap().code),"Conflict");
  assert_eq!(format!("{:?}",store.publish(vec![1;20],vec![3;20],3,vec![]).err().unwrap().code),"Conflict");
  (initial,store.budget().used_bytes,read.bytes.len())
 }};
}
fn main()->Result<(),Box<dyn std::error::Error>>{
 for size in [8usize,64,1024,65536] {
  let mut values:Vec<u8>=(0..size).map(|i|((i*37)%256) as u8).collect();
  values[..5].fill(42);
  let before=run!(baseline,values,8*1024*1024u64);
  let after=run!(candidate,values,8*1024*1024u64);
  assert_eq!(before.2,after.2);
 }
 let bytes=vec![42;16*1024*1024+1];
 let old=run!(baseline,bytes,256*1024*1024u64);
 let new=run!(candidate,bytes,256*1024*1024u64);
 assert_eq!(old.2,new.2);assert!(new.0*2<old.0,"binary storage did not materially reduce resident budget");
 println!("PASS resident delta comparison: payload={}, old_open={}, binary_open={}, old_after_publish={}, binary_after_publish={}",old.2,old.0,new.0,old.1,new.1);
 Ok(())
}
