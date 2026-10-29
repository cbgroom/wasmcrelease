use sdk::wasmc::compression::gzip::{compress,decompress};
#[unsafe(no_mangle)]
pub extern "C" fn run(size:u32)->u32 {
 let mut x=0x12345678u32;let bytes:Vec<u8>=(0..size).map(|_|{x^=x<<13;x^=x>>17;x^=x<<5;x as u8}).collect();let mut flags=0;
 if let Ok(compressed)=compress(&bytes) {flags|=1;if decompress(&compressed).is_ok_and(|out|out==bytes){flags|=2;}}
 if decompress(b"invalid").is_err(){flags|=4;}
 if compress(b"ok").is_ok_and(|b|decompress(&b).is_ok_and(|v|v==b"ok")){flags|=8;}
 flags
}
