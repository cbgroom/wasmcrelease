// Read-only build-workspace witness. It never copies implementation source.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,readdirSync,readFileSync,realpathSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readCommittedBuildInput(checkout,revision,path){
  return execFileSync('git',['show',`${revision}:${path}`],{cwd:checkout,maxBuffer:64*1024*1024});
}
function identity(path){
  const stat=lstatSync(path);assert(stat.isFile()&&!stat.isSymbolicLink(),'linked/non-file build input');
  assert(stat.size<=4*1024*1024,'build input exceeds witness limit');
  const bytes=readFileSync(path);return {bytes:bytes.length,sha256:sha(bytes)};
}
export function snapshotBuildInputs(workspace,{siblingWit=false}={}){
  const base=resolve(workspace);
  assert.equal(realpathSync(base),base,'linked build-workspace path');
  assert(lstatSync(base).isDirectory()&&!lstatSync(base).isSymbolicLink());
  const files={};
  const walk=(dir,prefix)=>{
    // Only Cargo output directories are excluded. src/target/ stays input.
    const cargo=existsSync(join(dir,'Cargo.toml'));
    for(const name of readdirSync(dir).sort()){
      const path=join(dir,name),stat=lstatSync(path);
      if(name==='target'&&cargo){
        assert(stat.isDirectory(),'unexpected Cargo target entry');continue;
      }
      assert(!stat.isSymbolicLink(),'linked build input entry');
      assert(name!=='.git','embedded Git workspace is not an input witness');
      if(stat.isDirectory())walk(path,prefix+name+'/');
      else files[prefix+name]=identity(path);
    }
  };
  walk(base,'workspace/');
  files['license-input/LICENSE']=identity(join(dirname(base),'LICENSE'));
  if(siblingWit)files['wit-input/lib.wit']=identity(join(dirname(base),'lib.wit'));
  const ordered=Object.fromEntries(Object.entries(files).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))));
  return {schema:'wasmc.current-v2-build-input-snapshot/v1',
    scope:'retained-workspace-and-declared-sibling-wit-license-excluding-Cargo-target-output',
    files:ordered,sha256:sha(Buffer.from(JSON.stringify(ordered)))};
}
export function verifyBuildInputsUnchanged(workspace,before,options){
  const after=snapshotBuildInputs(workspace,options);
  assert.deepEqual(after,before,'build inputs changed during producer execution');
  return after;
}
