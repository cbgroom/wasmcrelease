from pathlib import Path
import subprocess,tarfile,hashlib,json,shutil
repo=Path('/Users/youxianshi/code/.worktrees/wasmc/WS-20261026-lib-memory-json-v1');state=Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028');sdk=state/'source-c130-capacity-edition-20261029';root=state/'sdk-deadline-reconstructed-c130-20261029';q=Path('/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification');root.mkdir(exist_ok=False)
p=subprocess.Popen(['git','archive','HEAD'],cwd=repo,stdout=subprocess.PIPE)
with tarfile.open(fileobj=p.stdout,mode='r|') as t:t.extractall(root,filter='data')
assert p.wait()==0
patches=['core-runtime-wide-arity-20261029.patch','wasmc-workspace-edition2024-20261029.patch','wasmc-baseline-example-features-20261029.patch','core-runtime-shared-memory-budget-v2-20261029.patch','core-runtime-deadline-classification-20261029.patch']
for p in patches:subprocess.run(['git','apply','--unidiff-zero',str(q/p)],cwd=root,check=True)
fixture='crates/wasmc_core_runtime/tests/fixtures/wasmc-json-0.2.1-shared-memory.wasm';f=root/fixture;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(q/'json-core-shared-memory-fixture-20261029.wasm',f)
files=subprocess.check_output(['git','ls-tree','-r','--name-only','HEAD','crates/wasmc_core_runtime'],cwd=repo,text=True).splitlines()+['crates/wasmc_core_runtime/src/shared_memory.rs',fixture,'Cargo.toml','Cargo.lock']
for name in patches:
 for line in (q/name).read_text().splitlines():
  if line.startswith('+++ b/') and line.endswith('Cargo.toml'):
   p=line[6:]
   if p not in files:files.append(p)
for p in files:
 if p.endswith('.rs'):subprocess.run(['rustfmt','--edition','2024','--config','skip_children=true',str(root/p)],check=True,capture_output=True)
mismatches=[p for p in files if not (sdk/p).exists() or (root/p).read_bytes() != (sdk/p).read_bytes()]
print('reconstructed',root,'compared',len(files),'mismatches',len(mismatches))
for p in mismatches:print('MISMATCH',p)
if mismatches:raise SystemExit(1)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
(root/'reconstruction-evidence.json').write_text(json.dumps({'source':'c1306cc8ec4497d2190f7ac72501979e4038bfae','patches':{p:sha(q/p) for p in patches},'files':{p:sha(root/p) for p in files},'rustfmt':subprocess.check_output(['rustfmt','--version'],text=True).strip(),'fixture':sha(q/'json-core-shared-memory-fixture-20261029.wasm')},indent=2)+'\n')
