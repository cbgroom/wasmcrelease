// Metadata-only snapshot of this invocation's generated adapter, before Drop.
// Does not watch global temporary directories, retain source bodies or run Cargo.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function snapshotGeneratedAdapter(workspace,adapter){
  const base=resolve(workspace),root=resolve(adapter);
  assert.equal(realpathSync(base),base,'linked workspace');
  assert(lstatSync(base).isDirectory(),'workspace must be a directory');
  assert.equal(dirname(root),base,'adapter must be an immediate workspace child');
  assert.match(basename(root),/^\.wasmc-rust-adapter-[0-9]+-[0-9]+$/,'unknown generated adapter path');
  assert.equal(realpathSync(root),root,'linked adapter root');
  assert(lstatSync(root).isDirectory(),'adapter must be a directory');
  const files={};let total=0;
  const walk=(dir,prefix)=>{
    for(const name of readdirSync(dir).sort()){
      const path=join(dir,name),stat=lstatSync(path);
      assert(!stat.isSymbolicLink(),'linked generated input');
      assert.notEqual(name,'.git','embedded Git directory');
      // Only this generated crate's Cargo output is outside the input tree.
      if(dir===root&&name==='target'){
        assert(stat.isDirectory(),'unexpected target entry');continue;
      }
      if(stat.isDirectory())walk(path,prefix+name+'/');
      else{
        assert(stat.isFile(),'non-file generated input');
        assert(stat.size<=8*1024*1024,'generated input exceeds per-file bound');
        assert(Object.keys(files).length<128,'too many generated input files');
        const bytes=readFileSync(path);total+=bytes.length;
        assert(total<=16*1024*1024,'generated inputs exceed total bound');
        files[prefix+name]={bytes:bytes.length,sha256:hash(bytes)};
      }
    }
  };
  walk(root,'');
  for(const path of ['Cargo.toml','Cargo.lock','mapping.json','src/lib.rs'])
    assert(Object.hasOwn(files,path),`missing generated input: ${path}`);
  const ordered=Object.fromEntries(Object.entries(files).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))));
  return {schema:'wasmc.generated-adapter-input-snapshot/v1',
    scope:'one-explicit-workspace-child-before-removal-excluding-root-Cargo-target',
    files:ordered,sha256:hash(Buffer.from(JSON.stringify(ordered)))};
}
export function verifyGeneratedAdapterUnchanged(workspace,adapter,before){
  const after=snapshotGeneratedAdapter(workspace,adapter);
  assert.deepEqual(after,before,'generated adapter inputs changed during Cargo execution');
  return after;
}
export function bindGeneratedAdapterReport(snapshot,{generated_source_sha256,mapping_sha256,cargo_lock_sha256}){
  // Expected digests must come from an independently selected producer report.
  // No report digest covers Cargo.toml: it remains a separately captured input.
  for(const [path,expected] of [['src/lib.rs',generated_source_sha256],['mapping.json',mapping_sha256],['Cargo.lock',cargo_lock_sha256]]){
    assert.match(expected??'',/^[0-9a-f]{64}$/,'missing expected producer digest');
    assert.equal(snapshot.files[path]?.sha256,expected,`producer digest mismatch: ${path}`);
  }
  return {source_mapping_lock_bound:true,manifest_independently_qualified:false,
    real_build_observed:false,full_transitive_license_audit:false,release_qualified:false};
}
