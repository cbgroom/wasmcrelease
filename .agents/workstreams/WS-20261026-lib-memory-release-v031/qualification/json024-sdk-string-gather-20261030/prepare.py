from pathlib import Path
import sys
sdk=Path(sys.argv[1]).read_text(); app=Path(sys.argv[2]).read_text(); out=Path(sys.argv[3]); out.mkdir(parents=True,exist_ok=False)
old='for i in 0..n{v.push(r(from,add(p,i),1) as u8);}assert!(std::str::from_utf8(&v).is_ok());'
new='let mut i=0u32;while n-i>=8{v.extend_from_slice(&r(from,add(p,i),8).to_le_bytes());i+=8;}while i<n{v.push(r(from,add(p,i),1) as u8);i+=1;}assert!(std::str::from_utf8(&v).is_ok());'
line=next(l for l in sdk.splitlines() if l.startswith('fn c_string(')); assert line.count(old)==1
# Test-only visibility lets the harness submit malformed string bytes.
base=sdk.replace('fn c_string(', 'pub(super) fn c_string(',1)
changed=base.replace(line.replace('fn c_string(', 'pub(super) fn c_string(',1),line.replace('fn c_string(', 'pub(super) fn c_string(',1).replace(old,new),1)
assert base!=changed
extra='''
#[unsafe(no_mangle)] pub extern "C" fn run_large() -> u32 { let input=format!("\\\"{}\\\"", "雪".repeat(350_000)); let out=wasmc::json::document::compact(&input).unwrap(); assert_eq!(out,input); out.len() as u32 }
#[unsafe(no_mangle)] pub extern "C" fn run_tails() -> u32 { for n in 0..32 { let input=format!("\\\"{}雪\\\"", "x".repeat(n)); let out=wasmc::json::document::compact(&input).unwrap(); assert_eq!(out,input); } 32 }
#[unsafe(no_mangle)] pub extern "C" fn run_invalid() { let input=[255u8]; let pair=[input.as_ptr() as u32,1]; let mut dst=[0u32;2]; __wasmc_canonical_transfer::c_string(pair.as_ptr() as u32,dst.as_mut_ptr() as u32,false,false); }
'''
(out/'baseline.rs').write_text(base+'\n'+app+'\n'+extra)
(out/'candidate.rs').write_text(changed+'\n'+app+'\n'+extra)
# The current new-value-window generator already bulk-copies provider bytes.
# Change only the own-memory gather; leave the legacy profile untouched.
scalar='for i in 0..n{v.push(r(from,add(p,i),1) as u8);}'
bulk='if from{if n!=0{unsafe{copy_from_lib(v.as_mut_ptr() as usize as i32,p as i32,n as i32);v.set_len(n as usize);}}}else{'+scalar+'}'
wide='if from{if n!=0{unsafe{copy_from_lib(v.as_mut_ptr() as usize as i32,p as i32,n as i32);v.set_len(n as usize);}}}else{let mut i=0u32;while n-i>=8{v.extend_from_slice(&r(from,add(p,i),8).to_le_bytes());i+=8;}while i<n{v.push(r(from,add(p,i),1) as u8);i+=1;}}'
base_line=line.replace('fn c_string(', 'pub(super) fn c_string(',1)
profile=base.replace(base_line,base_line.replace(scalar,bulk),1)
optimized=base.replace(base_line,base_line.replace(scalar,wide),1)
assert profile!=optimized and profile!=base
(out/'profile.rs').write_text(profile+'\n'+app+'\n'+extra)
(out/'optimized.rs').write_text(optimized+'\n'+app+'\n'+extra)
