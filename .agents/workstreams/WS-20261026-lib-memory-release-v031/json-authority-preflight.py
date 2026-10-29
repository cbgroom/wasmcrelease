#!/usr/bin/env python3
"""Create a local, unadmitted JSON authority tree using an isolated Git index."""
import hashlib, json, os, subprocess, tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[3]
product = Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v022-combined-product-20261029')
out = Path('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v022-authority-preflight-20261029')
base = '47f3dc59a9bd7323421351a1e143f44474a89cef'
catalog_sha = '686d24a7f78994eacd24f117381191d064c2078f231b2a9fa7f6c68ba2f3b9cd'
tag_sha = '97a88f957ccd9f4a26c3a11723e5d7664165783267ba70f30189590e3aa63a44'
def git(*args, data=None, env=None):
    return subprocess.check_output(['git', *args], cwd=repo, input=data, env=env)
def blob(b):
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def tree(commit):
    result={}
    for line in git('ls-tree','-r','-z',commit).split(b'\0'):
        if line:
            meta,path=line.split(b'\t',1); mode,kind,oid=meta.split(); result[path.decode()]=(mode.decode(),kind.decode(),oid.decode())
    return result
raw=(product/'catalog/libs-current-v2.json').read_bytes(); assert hashlib.sha256(raw).hexdigest()==catalog_sha
catalog=json.loads(raw); assert catalog['package_authority_commit']=='0'*40
assert hashlib.sha256((out/'refs.txt').read_bytes()).hexdigest()==tag_sha
res=subprocess.check_output(['node','scripts/audit-tagged-root-identities-v1.mjs',str(repo),str(product),catalog_sha,str(out/'refs.txt'),tag_sha],cwd=repo)
audit=json.loads(res); assert audit['accepted'] and 'wasmc-json' in audit['untagged_ids']
base_tree=tree(base); assert not any(p.startswith('current-libs/wasmc-json/0.2.2/') for p in base_tree)
selected={}
for row in catalog['packages']:
    for pin in row['files']+list(row['source'].values()):
        b=(product/pin['path']).read_bytes(); assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
        assert pin['path'] not in selected; selected[pin['path']]=b
registry=catalog['registry']; rb=(product/registry['path']).read_bytes(); assert len(rb)==registry['bytes'] and hashlib.sha256(rb).hexdigest()==registry['sha256']
assert base_tree[registry['path']][2]==blob(rb)
changed={p:b for p,b in selected.items() if p not in base_tree or base_tree[p][2]!=blob(b)}
expected={p for p in selected if p.startswith('current-libs/wasmc-json/0.2.2/')} | {'libspec/wasmc-json/lib.json','libspec/wasmc-json/lib.wit'}
assert set(changed)==expected and len(changed)==27
assert all(base_tree[p][0:2]==('100644','blob') for p in changed if p in base_tree)
with tempfile.TemporaryDirectory(prefix='authority-index-',dir=out) as temp:
    env=dict(os.environ,GIT_INDEX_FILE=str(Path(temp)/'index'))
    git('read-tree',base,env=env)
    entries=[]
    for path,b in sorted(changed.items()):
        oid=git('hash-object','-w','--stdin',data=b,env=env).decode().strip(); assert oid==blob(b)
        entries.append(f'100644 {oid}\t{path}\n')
    git('update-index','--index-info',data=''.join(entries).encode(),env=env)
    tree_oid=git('write-tree',env=env).decode().strip()
    commit=git('commit-tree',tree_oid,'-p',base,data=b'Prepare local JSON 0.2.2 authority candidate\n\nUnadmitted proof candidate; not a release.\n',env=env).decode().strip()
actual=tree(commit)
assert set(p for p in set(actual)|set(base_tree) if actual.get(p)!=base_tree.get(p))==set(changed)
assert all(actual[p]==('100644','blob',blob(b)) for p,b in selected.items())
assert actual[registry['path']]==base_tree[registry['path']]
ref='refs/heads/work/WS-20261029-json022-authority-local-v1'
git('update-ref',ref,commit,'0'*40)
result={'schema':'wasmc.local-json-authority-preflight/v1','base':base,'local_commit':commit,'local_ref':ref,'candidate_catalog_sha256':catalog_sha,'remote_tag_listing_sha256':tag_sha,'tag_audit':audit,'selected_file_count':len(selected),'unchanged_selected_files':len(selected)-len(changed),'changed_paths':sorted(changed),'changed_count':len(changed),'registry_exact':True,'private_capsule_copied':False,'source_admitted':False,'public_admission':False,'release':False}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['base','local_commit','local_ref','selected_file_count','unchanged_selected_files','changed_count','private_capsule_copied','source_admitted','public_admission']}))
