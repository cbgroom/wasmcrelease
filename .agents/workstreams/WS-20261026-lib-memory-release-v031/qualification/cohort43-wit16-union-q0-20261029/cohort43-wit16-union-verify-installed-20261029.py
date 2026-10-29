import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
b=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028');root=b/'cohort43-wit16-union-install-all-20261029';producer=b/'wasmc-wit16-union-target-20261029/debug/wasmc';h=hashlib.sha256(producer.read_bytes()).hexdigest();assert h=='924dc71ebaa01f027d0ce8a247b7d22f9743dee1c10bc57aef6470996f373179';print(json.dumps({'producer_sha256_before':h}),flush=True)
d=json.loads((root/'receipt.json').read_text());rows=[r for r in d['results'] if r['profile']!='native']
def one(r):
 p=(root/r['id']/'current-libs'/r['id']/r['version']).resolve(strict=True);assert hashlib.sha256((p/'lib.json').read_bytes()).hexdigest()==r['manifest_sha256']
 try:
  x=subprocess.run([str(producer),'lib','verify',str(p)],capture_output=True,text=True,timeout=180);return {'id':r['id'],'manifest_sha256':r['manifest_sha256'],'exit':x.returncode,'stderr':x.stderr.strip()}
 except subprocess.TimeoutExpired:return {'id':r['id'],'exit':'timeout'}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as x:rows=list(x.map(one,rows))
for r in rows:print(json.dumps(r),flush=True)
assert hashlib.sha256(producer.read_bytes()).hexdigest()==h
print(json.dumps({'total':len(rows),'passed':sum(r['exit']==0 for r in rows),'producer_sha256_after':h}),flush=True)
if any(r['exit']!=0 for r in rows):sys.exit(1)
