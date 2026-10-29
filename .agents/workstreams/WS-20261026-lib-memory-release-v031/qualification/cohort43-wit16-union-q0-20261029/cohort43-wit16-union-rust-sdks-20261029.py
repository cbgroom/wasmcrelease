import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
b=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028');root=b/'cohort43-wit16-union-install-all-20261029';out=b/'cohort43-wit16-union-rust-sdks-20261029';out.mkdir();d=json.loads((root/'receipt.json').read_text());items=[]
for row in d['results']:
 p=root/row['id']/'current-libs'/row['id']/row['version'];m=json.loads((p/'lib.json').read_text())
 for kind,info in m.get('bindings',{}).items():
  c=info.get('cargo_toml') if isinstance(info,dict) else None
  if not c:continue
  cargo=(p/c['path']).read_bytes();assert hashlib.sha256(cargo).hexdigest()==c['sha256'];assert b'edition = "2024"' in cargo
  if kind=='rust_core':
   source=info['source'];src=(p/source['path']).read_bytes();assert hashlib.sha256(src).hexdigest()==source['sha256'];items.append((row['id'],p/source['path'],source['sha256']))
assert len(items)==17
def build(item):
 id,path,digest=item;dest=out/('lib'+id.replace('-','_')+'.rlib');p=subprocess.run(['rustc','--edition=2024','--target','wasm32-unknown-unknown','--crate-name','sdk','--crate-type','rlib','-C','opt-level=2','-Awarnings',str(path),'-o',str(dest)],capture_output=True,text=True,timeout=180);return {'id':id,'sdk_sha256':digest,'exit':p.returncode,'stderr':p.stderr,'rlib_sha256':hashlib.sha256(dest.read_bytes()).hexdigest() if dest.exists() else None}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex: rows=list(ex.map(build,items))
for row in rows:print(json.dumps(row),flush=True)
print(json.dumps({'total':len(rows),'passed':sum(row['exit']==0 for row in rows)}),flush=True)
if any(row['exit']!=0 for row in rows):sys.exit(1)
