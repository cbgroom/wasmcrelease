import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
base=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028')
run=base/'notice-budget-refresh-evidence-20261028/runs/refresh-axo8hB'
producer=base/'wasmc-2024-notice-union-target-20261029/debug/wasmc'
producer_sha=hashlib.sha256(producer.read_bytes()).hexdigest()
assert producer_sha=='45e229a3201de33ef0e4e362b6b2ea7abe45f2097913c5f8c22b1992fa50fc59'
print(json.dumps({'producer_sha256_before':producer_sha}),flush=True)
receipt=json.loads((run/'refresh-receipt.json').read_text())
rows=[r for r in receipt['rows'] if r['profile']!='native']
def one(row):
 root=Path(row['package_root']); h=hashlib.sha256((root/'lib.json').read_bytes()).hexdigest()
 assert h==row['manifest_sha256']
 try:
  p=subprocess.run([str(producer),'lib','verify',str(root)],capture_output=True,text=True,timeout=120)
  return {'id':row['id'],'manifest_sha256':h,'exit':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
 except subprocess.TimeoutExpired:return {'id':row['id'],'manifest_sha256':h,'exit':'timeout'}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
 results=list(ex.map(one,rows))
for row in results: print(json.dumps(row),flush=True)
assert hashlib.sha256(producer.read_bytes()).hexdigest()==producer_sha
print(json.dumps({'total':len(results),'passed':sum(x['exit']==0 for x in results),'producer_sha256_after':producer_sha}),flush=True)
if any(x['exit']!=0 for x in results):sys.exit(1)
