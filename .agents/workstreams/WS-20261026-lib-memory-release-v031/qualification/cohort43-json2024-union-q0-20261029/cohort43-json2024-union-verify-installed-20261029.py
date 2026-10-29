import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
b=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028');root=b/'cohort43-json2024-union-install-all-20261029';producer=b/'wasmc-2024-notice-union-target-20261029/debug/wasmc';h=hashlib.sha256(producer.read_bytes()).hexdigest();assert h=='45e229a3201de33ef0e4e362b6b2ea7abe45f2097913c5f8c22b1992fa50fc59';print(json.dumps({'producer_sha256_before':h}),flush=True)
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
