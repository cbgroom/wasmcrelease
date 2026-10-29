import subprocess,json,sys
from pathlib import Path
old,new=map(Path,sys.argv[1:])
cases=[('validate','{"x":1e400,"x":1}','ok','err(invalid-json)'),('validate','{"x":{"z":1e400},"x":1}','ok','err(invalid-json)'),('validate',r'{"x":"\ud800","x":1}','ok','err(invalid-json)'),('compact','{"x":1e400,"x":1}','ok("{\\"x\\":1}")','err(invalid-json)'),('compact','{"x":1,"x":2}','ok("{\\"x\\":2}")','ok("{\\"x\\":2}")'),('validate','{"ok":true}','ok','ok')]
for label,path,index in [('old',old,2),('new',new,3)]:
 for case in cases:
  name,value=case[:2];fn=f'wasmc:json/document.{name}@0.2.1({json.dumps(value,ensure_ascii=False)})';r=subprocess.run(['wasmtime','run','--invoke',fn,str(path)],text=True,capture_output=True,timeout=30);result={'candidate':label,'function':name,'input':value,'exit':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr};print(json.dumps(result,ensure_ascii=False),flush=True);assert r.returncode==0 and r.stdout.strip()==case[index],result
