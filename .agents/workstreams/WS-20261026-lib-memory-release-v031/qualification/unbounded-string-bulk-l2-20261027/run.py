import fcntl,subprocess,os,shutil,time,json,hashlib,pathlib
b=pathlib.Path('/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32');p=b/'string-bulk-l2-20261027';target=b/'unbounded-l1-warm-20261027';cwd='/Users/youxianshi/code/.worktrees/wasmc/WS-20261027-unbounded-l1';lock=open(target/'.l1-writer.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);free=shutil.disk_usage(cwd).free;assert free>101*2**30,free
env=os.environ.copy();env.update(CARGO_TARGET_DIR=str(target),CARGO_NET_OFFLINE='true',CARGO_BUILD_JOBS='2',RUSTC_WRAPPER='',WASMC_SDK_PROFILE='checked-chunk-transfer-v1',WASMC_STRING_BULK_OUTPUT=str(p/'fixture'));cmd=['cargo','+1.96.0','test','--locked','--offline','--test','canonical_string_bulk_transfer_v1','--','--nocapture'];start=time.monotonic();floor=False
with open(p/'test.log','xb') as log:
 proc=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 while proc.poll() is None:
  if shutil.disk_usage(cwd).free < 100*2**30:floor=True;os.killpg(proc.pid,15);break
  time.sleep(2)
 code=proc.wait()
data=(p/'test.log').read_bytes();out={'command':cmd,'exit':code,'floor_reached':floor,'duration_seconds':round(time.monotonic()-start,1),'log_sha256':hashlib.sha256(data).hexdigest(),'workspace_commit':'49310c88ba579b53a6f9d894ddc76fe2be2075ed','workspace_modification':'one historical fixture-path patch in unrelated test remains; not an unmodified full L2','profile':'checked-chunk-transfer-v1','free_gib':round(shutil.disk_usage(cwd).free/2**30,2)};(p/'receipt.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
