use wasmc_compression_component::{Compression,wasmtime::{Engine,Store,component::{Component,Linker}}};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let path=std::env::args().nth(1).ok_or("missing component")?;
 let engine=Engine::default();let component=Component::from_file(&engine,path)?;let mut store=Store::new(&engine,());
 let instance=Compression::instantiate(&mut store,&component,&Linker::<()>::new(&engine))?;let gzip=instance.wasmc_compression_gzip();
 let mut x=0x12345678u32;let data:Vec<u8>=(0..(17*1024*1024+1)).map(|_|{x^=x<<13;x^=x>>17;x^=x<<5;x as u8}).collect();
 let compressed=gzip.call_compress(&mut store,&data)?.map_err(|e|format!("{e:?}"))?;assert!(compressed.len()>16*1024*1024);
 let restored=gzip.call_decompress(&mut store,&compressed)?.map_err(|e|format!("{e:?}"))?;assert_eq!(restored,data);
 assert!(gzip.call_decompress(&mut store,b"invalid gzip")?.is_err());
 let next=gzip.call_compress(&mut store,b"next input")?.map_err(|e|format!("{e:?}"))?;let recovered=gzip.call_decompress(&mut store,&next)?.map_err(|e|format!("{e:?}"))?;assert_eq!(recovered,b"next input");
 println!("PASS input={} compressed={} invalid_recovery=true",data.len(),compressed.len());Ok(()) }
