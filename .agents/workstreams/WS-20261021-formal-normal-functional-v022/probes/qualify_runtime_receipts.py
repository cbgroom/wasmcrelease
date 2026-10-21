import json,hashlib,subprocess,socket,datetime,shutil
from pathlib import Path
root=Path.cwd();out=root/'target/v022-HTTPS-runtime-receipts';out.mkdir(exist_ok=False)
archive=root/'target/v022-HTTPS-runtime-dev2/source.tar.gz'
source='9c34b6030a4e17bf7f08c551d229262e668c897d'
snapshot=root/('target/v022-HTTPS-runtime-dev2/wasmcrelease-'+source)
expected='022fe99dce868b2074cf90412bfac8f6b2d7c969b47aabf10e6b7804977e6c55'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(archive.read_bytes())==expected
candidate=json.loads((snapshot/'channels/candidates/0.0.22.json').read_text())
def check():
 assert not (snapshot/'.git').exists() and not (snapshot/'src/compiler').exists()
 for row in candidate['product_files']:
  b=(snapshot/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
check();compiler=(snapshot/'runtime/wasmc-runtime-v0/compiler.wasm').read_bytes();compiler_sha=sha(compiler)
assert compiler_sha=='620a6b5f7b9a4565f14857975e37a03196f8f7e4279a2f4da388882638f2a658'
for engine in ['node','bun','deno']:
 exe=Path(shutil.which(engine)).resolve();steps=[]
 def run(label,args):
  r=subprocess.run([str(exe)]+args,cwd=snapshot/'runtime/wasmc-runtime-v0',text=True,capture_output=True)
  (out/(engine+'-'+label+'.stdout')).write_text(r.stdout);(out/(engine+'-'+label+'.stderr')).write_text(r.stderr)
  assert r.returncode==0,(engine,label,r.stderr)
  steps.append({'name':label,'command':[str(exe)]+args,'exit':r.returncode,'stdout_sha256':sha(r.stdout.encode()),'stderr_sha256':sha(r.stderr.encode())});return r.stdout
 version=run('version',['--version']).strip()
 prefix=['run','--allow-read','--allow-write'] if engine=='deno' else []
 result=json.loads(run('self-test',prefix+['bootstrap.mjs','self-test']));assert result['accepted'] and result['compiler_bytes']==len(compiler)
 binary=out/(engine+'.wasm')
 comp=json.loads(run('compile',prefix+['bootstrap.mjs','compile','--input','examples/add.wasmc','--output',str(binary)]));assert comp['accepted'] and comp['output_bytes']==44
 oracle=run('independent-oracle',prefix+[str(snapshot/'scripts/assert-runtime-output.mjs'),str(binary)])
 assert 'run(6,18)=42' in oracle and 'imports=0' in oracle and len(binary.read_bytes())==44
 result.update({'runtime_version':version,'candidate_commit':source,'compiler_sha256':compiler_sha,
 'source_free_package':{'archive_sha256':expected,'private_source_checked_out':False},
 'host':{'hostname':socket.gethostname(),'uname':subprocess.check_output(['uname','-a'],text=True).strip()},
 'execution':{'self_test':True,'compile':True,'compile_output_bytes':44,'wasm_validate':True,'instantiate':True,'oracle_export':'run','oracle_args':[6,18],'oracle_result':42},
 'tool_source':{'provider':'local-executable','command':engine,'executable_sha256':sha(exe.read_bytes())},
 'executed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'evidence':{'steps':steps,'compile_output_sha256':sha(binary.read_bytes())}})
 target=root/f'runtime/wasmc-runtime-v0/receipts/{engine}-self-test.json';target.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'engine':engine,'actual_exit':0,'receipt_sha256':sha(target.read_bytes()),'source':source,'archive':expected}))
check();assert sha(archive.read_bytes())==expected
