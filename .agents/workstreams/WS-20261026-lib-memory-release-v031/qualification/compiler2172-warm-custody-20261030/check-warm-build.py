#!/usr/bin/env python3
import hashlib,json,os,pathlib,subprocess,sys
source=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir();target=pathlib.Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/compiler-checked-sdk-v3-612-20261029');artifact=target/'wasm32-unknown-unknown/release/wasmc_wasm_cdylib.wasm';expected='2172f1821a6cac9c78158806b918fd013069a9b79a11fa34ed1fcc1708ff5164';paths=['Cargo.toml','Cargo.lock','build.rs','src','crates','.cargo']
def git(*a):return subprocess.run(['git',*a],cwd=source,check=True,capture_output=True).stdout
def sha(b):return hashlib.sha256(b).hexdigest()
def snapshot():
 assert not git('status','--porcelain=v1','--',*paths), 'tracked build inputs dirty'
 head=git('rev-parse','HEAD').decode().strip();assert head=='6fcfe8d86b19b491919b96b9bade8d8556477671',head
 rows=[]
 for raw in git('ls-files','-s','-z','--',*paths).split(b'\0'):
  if not raw:continue
  header,name=raw.split(b'\t',1);mode,oid,stage=header.decode().split();assert stage=='0';p=source/os.fsdecode(name);assert p.is_file() and not p.is_symlink(),str(p);data=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert blob==oid,str(p);rows.append({'path':os.fsdecode(name),'git_blob':oid,'sha256':sha(data),'bytes':len(data)})
 assert len(rows)==121,len(rows)
 return {'source':head,'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'inputs':rows}
before=snapshot();(out/'before.json').write_text(json.dumps(before,sort_keys=True,separators=(',',':'))+'\n');assert sha(artifact.read_bytes())==expected,'cached target differs'
env=os.environ.copy();env['CARGO_TARGET_DIR']=str(target);env['WASMC_SDK_PROFILE']='checked-chunk-transfer-v1';env['RUSTC_WRAPPER']=''
for k in ['RUSTFLAGS','CARGO_ENCODED_RUSTFLAGS']:env.pop(k,None)
cmd=['cargo','build','--locked','--offline','--release','--target','wasm32-unknown-unknown','--manifest-path','crates/wasmc_wasm_cdylib/Cargo.toml']
r=subprocess.run(cmd,cwd=source,env=env,capture_output=True,text=True,timeout=240);(out/'cargo.log').write_text(r.stdout+r.stderr);after=snapshot();(out/'after.json').write_text(json.dumps(after,sort_keys=True,separators=(',',':'))+'\n');same=before==after;actual=sha(artifact.read_bytes());compiled=[s.strip() for s in r.stderr.splitlines() if s.lstrip().startswith('Compiling ')];receipt={'schema':'wasmc.compiler-warm-custody-check/v1','source_head':before['source'],'source_tree':before['tree'],'exit':r.returncode,'input_count':len(before['inputs']),'inputs_match_git_and_stable':same,'before_sha256':sha((out/'before.json').read_bytes()),'after_sha256':sha((out/'after.json').read_bytes()),'compiler_sha256':actual,'expected_sha256':expected,'compiled_crates':compiled,'build_profile':'checked-chunk-transfer-v1','canonical_master':False,'formal_release':False,'limits':['warm build evidence, not original clean build receipt','no integrated master or canonical source custody','no release']};(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));assert r.returncode==0 and same and actual==expected
