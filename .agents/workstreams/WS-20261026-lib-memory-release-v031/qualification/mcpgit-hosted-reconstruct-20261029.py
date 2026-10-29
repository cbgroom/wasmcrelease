from pathlib import Path
import subprocess,tarfile,shutil,hashlib,json
repo=Path('/Users/youxianshi/code/.worktrees/MCPGit/rustc-1991-runtime-v1');state=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028');sdk=state/'sdk-deadline-reconstructed-c130-20261029';root=state/'mcpgit-hosted-reconstructed-779-20261029';q=Path('/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification');root.mkdir(exist_ok=False)
p=subprocess.Popen(['git','archive','HEAD'],cwd=repo,stdout=subprocess.PIPE)
with tarfile.open(fileobj=p.stdout,mode='r|') as t:t.extractall(root,filter='data')
assert p.wait()==0
patches=['mcpgit-json-shared-memory-host-v2-20261029.patch','hosted-json-import-boundary-20261029.patch','hosted-mixed-import-plan-candidate-20261029.patch','mixed-http-json-executor-candidate-20261029.patch','mixed-http-json-service-candidate-20261029.patch','hosted-selected-core-lib-candidate-20261029.patch','hosted-deadline-classification-20261029.patch','hosted-selected-lib-service-e2e-20261029.patch']
for name in patches:subprocess.run(['git','apply','--unidiff-zero',str(q/name)],cwd=root,check=True)
fixtures=root/'crates/mcpgit-executable-runtime/tests/fixtures/mixed-http-json-20261029';fixtures.mkdir(parents=True,exist_ok=True)
for source,dest in [('mixed-http-json-guest-20261029.rs','guest.rs'),('mixed-http-json-guest-20261029.wasm','guest.wasm'),('mixed-http-json-table-guest-20261029.rs','guest-with-table.rs'),('mixed-http-json-table-guest-20261029.wasm','guest-with-table.wasm'),('hosted-selected-lib-guest-20261029.rs','hosted-binary-guest.rs'),('hosted-selected-lib-guest-20261029.wasm','hosted-binary-guest.wasm')]:shutil.copyfile(q/source,fixtures/dest)
for name in ['mcpgit-executable-runtime','mcpgit-programmable-query-runtime','mcpgit-system-bundle']:
 file=root/'crates'/name/'Cargo.toml';s=file.read_text();lines=s.splitlines(keepends=True);found=0
 for n,line in enumerate(lines):
  if line.startswith('wasmc-core-runtime = '):
   lines[n]='wasmc-core-runtime = { path = "'+str(sdk/'crates/wasmc_core_runtime')+'", default-features = false, features = ["core-runtime-sdk"] }\n';found+=1
 assert found==1;file.write_text(''.join(lines))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
(root/'reconstruction-evidence.json').write_text(json.dumps({'base':'7797450d5bd93db7a3cdea8a943b567ac25994d6','sdk_source':str(sdk),'patches':{p:sha(q/p) for p in patches},'fixtures':{p.name:sha(p) for p in fixtures.iterdir()},'test_only_overrides':['crates/'+n+'/Cargo.toml' for n in ['mcpgit-executable-runtime','mcpgit-programmable-query-runtime','mcpgit-system-bundle']]},indent=2)+'\n')
print('reconstructed',root,'patches',len(patches))
