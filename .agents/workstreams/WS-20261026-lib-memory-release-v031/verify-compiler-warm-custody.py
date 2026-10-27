from pathlib import Path
import os,subprocess,json,hashlib,shutil,time
root=Path('/Users/youxianshi/code/.worktrees/wasmc/WS-20261026-lib-memory-json-v1')
pool=Path('/Users/youxianshi/code/.cargo-target-pools/wasmc/d6154099871da09491d12e955cfd6d202efba9f7beae41ef55ffda6d23349923')
out=Path('/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32/compiler-warm-custody-20261027')
old='c1919489229b8518931419958aac97b0d16e5abe';head='ea49b8bb9581d29d13e6d3d5dd267da7e02ad6ef';expected='d725ecc9e6fe5b2717b566bdc86b7a571f76b4abc71f111f048f91bb539ded09'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
assert git('rev-parse','HEAD').decode().strip()==head and not git('status','--porcelain').strip()
assert shutil.disk_usage(root).free>=100*2**30 and not out.exists();out.mkdir()
paths=git('ls-files','-z','--','Cargo.toml','Cargo.lock','build.rs','src','crates','docs','.cargo').decode().split('\0');paths=[x for x in paths if x and (root/x).is_file()];assert len(paths)==710
entries=git('ls-tree','-rz','--full-tree',old,'--','Cargo.toml','Cargo.lock','build.rs','src','crates','docs','.cargo').split(b'\0');blobs={}
for row in filter(None,entries):
 meta,name=row.split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob';blobs[name.decode()]={'mode':mode,'oid':oid}
def inputs():
 result={}
 for name in paths:
  p=root/name;st=p.stat();b=p.read_bytes();after=p.stat();assert (st.st_ino,st.st_size,st.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
  oid=hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest();assert blobs[name]['oid']==oid,name
  result[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'build_blob':oid,'mode':blobs[name]['mode']}
 return result
before=inputs();(out/'inputs.json').write_text(json.dumps(before,sort_keys=True,indent=2)+'\n')
artifact=pool/'wasm32-unknown-unknown/release/wasmc_wasm_cdylib.wasm';assert hashlib.sha256(artifact.read_bytes()).hexdigest()==expected
locks=[str(p) for p in (pool/'release/.cargo-lock',pool/'wasm32-unknown-unknown/release/.cargo-lock') if p.exists()];probe=subprocess.run(['lsof','-n',*locks],capture_output=True,text=True);assert probe.returncode in (0,1) and not probe.stdout.strip()
lock=pool/'.wasmc-writer.lock';fd=os.open(lock,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.write(fd,json.dumps({'pid':os.getpid(),'head':head,'scope':'warm compiler custody verification'}).encode());os.close(fd)
try:
 env=os.environ.copy();env.update(CARGO_TARGET_DIR=str(pool),CARGO_BUILD_JOBS='2',CARGO_INCREMENTAL='0',RUSTC_WRAPPER='',RUSTFLAGS='');cmd=['cargo','+1.96.0','build','--locked','--offline','--release','--target','wasm32-unknown-unknown','--manifest-path','crates/wasmc_wasm_cdylib/Cargo.toml']
 with (out/'warm-build.log').open('w') as f:
  p=subprocess.Popen(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  while p.poll() is None:
   time.sleep(1)
   if shutil.disk_usage(root).free<100*2**30:
    p.terminate();p.wait();raise RuntimeError('free space floor reached')
  status=p.wait()
 after=inputs();assert before==after;digest=hashlib.sha256(artifact.read_bytes()).hexdigest();lines=(out/'warm-build.log').read_text().splitlines();compiled=[x.strip() for x in lines if x.lstrip().startswith('Compiling ')];r={'schema':'wasmc.compiler-warm-custody-check/v1','source_head':head,'build_source':old,'status':status,'input_count':len(before),'inputs_equal_build_git_blobs':True,'inputs_stable':True,'inputs_manifest_sha256':hashlib.sha256((out/'inputs.json').read_bytes()).hexdigest(),'compiler_sha256':digest,'compiling_lines':compiled,'unchanged_cold_rebuild':False,'canonical_master':False,'formal_release':False};(out/'receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True);assert status==0 and digest==expected and not compiled
finally:
 lock.unlink()
