#!/usr/bin/env python3
import concurrent.futures,hashlib,json,os,pathlib,re,subprocess,sys,tomllib
product=pathlib.Path(sys.argv[1]).resolve();installed=pathlib.Path(sys.argv[2]).resolve();out=pathlib.Path(sys.argv[3]).resolve();out.mkdir()
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cat=product/'catalog/libs-current-v2.json';assert hash_file(cat)=='ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192';catalog=json.loads(cat.read_text());assert len(catalog['packages'])==43
rustc=subprocess.run(['rustc','--version'],capture_output=True,text=True,check=True).stdout.strip();assert rustc.startswith('rustc 1.99.1 '),rustc
cached=pathlib.Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v022-component-large-target-20261029/debug/deps');rlib=cached/'libwasmtime-7614db13154710a4.rlib';depinfo=cached/'wasmtime-7614db13154710a4.d';assert rlib.is_file() and '/wasmtime-49.0.0/src/lib.rs' in depinfo.read_text()
excluded={'wasmc-app-authorization-policy','wasmc-tls-client','wasmc-tls-core'};selected=[];omitted=[]
for row in catalog['packages']:
 root=installed/row['id']/row['root'];manifest=root/'lib.json';assert hash_file(manifest)==row['manifest_sha256'];data=json.loads(manifest.read_text());component=(data.get('bindings') or {}).get('rust_component')
 if not component:continue
 if row['id'] in excluded:omitted.append(row['id']);continue
 src=root/component['source']['path'];cargo=root/component['cargo_toml']['path'];wit=root/'lib.wit'
 assert hash_file(src)==component['source']['sha256'] and hash_file(cargo)==component['cargo_toml']['sha256'] and hash_file(wit)==component['wit_sha256'],row['id']
 manifest_obj=tomllib.loads(cargo.read_text());assert manifest_obj['package']['edition']=='2024' and manifest_obj['dependencies']['wasmtime']['version']=='=49.0.0',row['id']
 selected.append((row,component,src,cargo,wit))
assert len(selected)==20 and set(omitted)==excluded,(len(selected),omitted)
def run(item):
 row,component,src,cargo,wit=item;name=row['id'];env=os.environ.copy();env['CARGO_MANIFEST_DIR']=str(cargo.parent);crate='sdk_'+re.sub('[^A-Za-z0-9_]','_',name)
 args=['rustc','--edition','2024','--crate-type','lib','--crate-name',crate,'--emit','metadata',str(src),'--extern',f'wasmtime={rlib}','-L',f'dependency={cached}','-o',str(out/(name+'.rmeta'))]
 try:
  r=subprocess.run(args,env=env,capture_output=True,text=True,timeout=180);(out/(name+'.log')).write_text(r.stdout+r.stderr);ok=r.returncode==0 and (out/(name+'.rmeta')).is_file();result={'id':name,'version':row['version'],'manifest_sha256':row['manifest_sha256'],'source_sha256':hash_file(src),'wit_sha256':hash_file(wit),'exit':r.returncode,'accepted':ok,'log':name+'.log'}
 except subprocess.TimeoutExpired as e:
  (out/(name+'.log')).write_text(str(e));result={'id':name,'accepted':False,'timeout':True,'log':name+'.log'}
 print(json.dumps(result),flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(run,selected))
result={'schema':'wasmc.installed-component-rust2024-compile/v1','accepted':all(x['accepted'] for x in rows),'catalog_sha256':hash_file(cat),'rustc':rustc,'wasmtime':'49.0.0','dependency_rlib_sha256':hash_file(rlib),'mode':'direct rustc metadata-only, cached dependency; no Cargo rebuild','excluded_security_domains':sorted(omitted),'compiled':len(rows),'rows':rows,'runtime_execution_claimed':False,'formal_release':False}
(out/'receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['accepted','compiled','wasmtime','runtime_execution_claimed','formal_release']}),flush=True)
if not result['accepted']:sys.exit(1)
