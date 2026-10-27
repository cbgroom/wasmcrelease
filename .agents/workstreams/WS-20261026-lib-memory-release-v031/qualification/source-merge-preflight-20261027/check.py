import pathlib,json,subprocess,hashlib
repo='/Users/youxianshi/code/.worktrees/wasmc/WS-20261026-lib-memory-json-v1';old='49310c88ba579b53a6f9d894ddc76fe2be2075ed';base='55415f7ced6ad2408e3f44ae7964bd0385fcc569';head='c1306cc8ec4497d2190f7ac72501979e4038bfae';expected_tree='cdd7a776730735b25a115ca0bf5cc80105d44b82';f=pathlib.Path('/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32/unbounded-committed-build-20261027/inputs.json');b=f.read_bytes();assert hashlib.sha256(b).hexdigest()=='0fd86242762aa681c40620548874467722a749e809adb58fae398abd0d9fb7ad';rows=json.loads(b)
def git(*x):return subprocess.check_output(['git',*x],cwd=repo)
tree=git('merge-tree','--write-tree',base,head).decode().strip();assert tree==expected_tree
def blobs(rev):
 out={}
 for row in git('ls-tree','-rz','--full-tree',rev).split(b'\0'):
  if not row:continue
  meta,name=row.split(b'\t',1);mode,typ,oid=meta.decode().split();out[name.decode()]=(mode,typ,oid)
 return out
original=blobs(old);merged=blobs(tree);bad=[]
for p,r in rows.items():
 if p not in merged or p not in original or original[p]!=merged[p] or original[p][2]!=r['git_blob']:bad.append(p)
assert not bad and len(rows)==711;changed=git('diff','--name-only',old,tree).decode().splitlines();other=[p for p in changed if not p.startswith('.agents/')];assert other==['.github/workflows/lib-memory-v031.yml'],other
print(json.dumps({'accepted':True,'preflight_only':True,'source_base':base,'source_head':head,'prospective_merge_tree':tree,'build_source':old,'input_count':len(rows),'all_input_git_modes_and_blobs_match':True,'non_agent_diff':other,'branch_or_master_changed':False,'formal_release':False}))
