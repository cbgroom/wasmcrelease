import pathlib,json,subprocess,hashlib
p=pathlib.Path(__file__).parent; old=pathlib.Path('/Users/youxianshi/.local/state/wasmc-maintenance/20261026-canonical-checked-results-32/runtime/native-63561/sealed');provider=pathlib.Path('/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification/corelib-memory-cache.wasm');plan=json.loads((old/'caller-plan.json').read_text());names={1:'caller.wasm',3:'lib-projection.wasm',4:'lib-calls.wasm',5:'canonical-entry.wasm',6:'app-projection.wasm',7:'host-entry.wasm',8:'host-projection.wasm',9:'host-calls.wasm'}
def leb(n):
 b=[]
 while True:
  v=n&127;n>>=7;b.append(v|(128 if n else 0))
  if not n:return bytes(b)
def dec(b,i):
 n=0;s=0
 while True:
  x=b[i];i+=1;n|=(x&127)<<s;s+=7
  if not x&128:return n,i
def normalize(b):
 a=b'wasmc-snapshot-provider';z=b'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0';out=b[:8];i=8
 while i<len(b):
  sec=b[i];size,start=dec(b,i+1);payload=b[start:start+size];i=start+size
  if sec==2:payload=payload.replace(leb(len(a))+a,leb(len(z))+z)
  out+=bytes([sec])+leb(len(payload))+payload
 return out
args=['/opt/homebrew/Cellar/binaryen/126/bin/wasm-merge'];rows=[]
for i,row in enumerate(plan['inputs']):
 data=normalize((p/names[i]).read_bytes()) if i in names else (p/'prepared/prepared-transfer.wasm').read_bytes() if i==0 else (p/'prepared/prepared-lib-core.wasm').read_bytes() if i==2 else provider.read_bytes()
 module='wasmc:lib/wasmc-text@0.0.2' if i==2 else row['module'];f=p/f'input-{i}.wasm';f.write_bytes(data);args.extend([str(f),module]);rows.append({'module':module,'sha256':hashlib.sha256(data).hexdigest()})
args+=['--rename-export-conflicts','--all-features','--quiet','-o',str(p/'app.wasm')];r=subprocess.run(args,capture_output=True,text=True);(p/'merge.log').write_text(r.stdout+r.stderr);(p/'inputs.json').write_text(json.dumps(rows,indent=2)+'\n');print('exit',r.returncode,r.stderr[:2000]);
if r.returncode==0:print('app',hashlib.sha256((p/'app.wasm').read_bytes()).hexdigest())
