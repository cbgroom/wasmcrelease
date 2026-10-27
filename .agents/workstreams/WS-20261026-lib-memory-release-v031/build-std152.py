from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys
base=Path('/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32')
workspace=base/'std-map-v152-workspace'
publication=base/'std-map-v152-publication'
source=Path('/Users/youxianshi/code/.worktrees/wasmc/WS-20261026-lib-memory-json-v1')
cli=Path('/Users/youxianshi/code/.worktrees/wasmc/WS-20261025-json-utf8-parts-v1/target/debug/wasmc')
old=Path('/Users/youxianshi/code/.cargo-target-pools/wasmc/WS-20261026-std-map-v151')
pool=Path('/Users/youxianshi/code/.cargo-target-pools/wasmc/WS-20261026-std-map-v152')
own=Path('.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification')
assert sys.argv[1:]==[] and workspace.is_dir() and cli.is_file() and old.is_dir() and not pool.exists() and not publication.exists()
assert not (old/'writer.lock').exists(),'prior pool currently has a writer'
assert shutil.disk_usage(workspace).free>=100*2**30
shutil.copytree(old,pool,copy_function=shutil.copy2)
assert not (old/'writer.lock').exists(),'prior pool acquired a writer during snapshot'
publication.mkdir()
lock=pool/'writer.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,json.dumps({'pid':os.getpid(),'task':'WS-20261026-lib-memory-release-v031','workspace':str(workspace)}).encode());os.close(fd)
def inputs():
 result={}
 for p in sorted(workspace.rglob('*')):
  if p.is_file():
   s=p.stat();b=p.read_bytes();t=p.stat();assert (s.st_ino,s.st_size,s.st_mtime_ns)==(t.st_ino,t.st_size,t.st_mtime_ns);result[str(p.relative_to(workspace))]=hashlib.sha256(b).hexdigest()
 return result
try:
 before=inputs();assert len(before)<4096 and shutil.disk_usage(workspace).free>=100*2**30
 activation={'schema':'wasmc.std-map-root-activation/v1','workspace':str(workspace),'source':str(source),'pool':str(pool),'warm_pool_snapshot':str(old),'inputs':before,'free_bytes':shutil.disk_usage(workspace).free,'build_scope':'changed Std 1.5.2 WIT/Component map removal; qualified Core input reused; no compiler build','network':'cargo offline','jobs':2}
 (own/'std-map-v152-build-first-activation.json').write_text(json.dumps(activation,indent=2)+'\n')
 env=os.environ.copy();env.update(WASMC_LIB_CARGO_TARGET_DIR=str(pool),CARGO_BUILD_JOBS='2',CARGO_INCREMENTAL='0',CARGO_PROFILE_DEV_DEBUG='0',CARGO_PROFILE_TEST_DEBUG='0',RUSTC_WRAPPER='',CARGO_NET_OFFLINE='true')
 cmd=[str(cli),'lib','build','--workspace',str(workspace),'--publication',str(publication),str(workspace/'lib.build.json')]
 with (own/'std-map-v152-build-first.log').open('w') as f:r=subprocess.run(cmd,cwd=source,env=env,stdout=f,stderr=subprocess.STDOUT)
 after=inputs();stable=before==after;root=publication/'wasmc-std';result={'status':r.returncode,'inputs_stable':stable,'root_created':(root/'lib.json').is_file(),'workspace':str(workspace),'publication':str(publication),'free_bytes_after':shutil.disk_usage(workspace).free,'formal_release':False};(own/'std-map-v152-build-first.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
 assert r.returncode==0 and stable and result['root_created']
finally:
 lock.unlink()
