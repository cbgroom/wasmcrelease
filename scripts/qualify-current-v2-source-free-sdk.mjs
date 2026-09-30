#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=process.argv.includes('--receipt');assert(process.argv.slice(2).every(x=>x==='--receipt'));
const batches=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json'].map(path=>JSON.parse(readFileSync(join(root,path))));
const scratch=mkdtempSync(join(tmpdir(),'wasmc-source-free-sdk-'));
const inventory=(directory,prefix='')=>{
  const files={};
  for(const name of readdirSync(directory).sort()){
    const path=join(directory,name),stat=lstatSync(path);assert(!stat.isSymbolicLink());
    if(stat.isDirectory())Object.assign(files,inventory(path,prefix+name+'/'));
    else {assert(stat.isFile());const bytes=readFileSync(path);files[prefix+name]={bytes:bytes.length,sha256:sha(bytes)};}
  }
  return files;
};
const roots=batches.flatMap(batch=>batch.packages);
const expectedFiles=[];
for(const row of roots){
  const source=join(root,row.root),destination=join(scratch,row.root);
  assert.deepEqual(row.builds[0].inventory,row.builds[1].inventory);
  assert.deepEqual(inventory(source),row.builds[0].inventory,'pinned generated root drift');
  mkdirSync(dirname(destination),{recursive:true});cpSync(source,destination,{recursive:true,errorOnExist:true,force:false});
  assert.deepEqual(inventory(destination),row.builds[0].inventory);
  expectedFiles.push(...Object.keys(row.builds[0].inventory).map(path=>row.root+'/'+path));
}
const consumer='libsrc/qualification/current-v2-consumer';
for(const name of ['Cargo.toml','Cargo.lock','src/main.rs']){
  const relative=consumer+'/'+name,destination=join(scratch,relative);
  mkdirSync(dirname(destination),{recursive:true});cpSync(join(root,relative),destination,{errorOnExist:true,force:false});expectedFiles.push(relative);
}
// The entire consumer tree contains only five exact generated roots and the
// public consumer test: no compiler, adapter, upstream or composition sources.
const before=inventory(scratch);assert.deepEqual(Object.keys(before).sort(),expectedFiles.sort());
assert.equal(expectedFiles.length,48);
const env={...process.env,CARGO_TARGET_DIR:join(root,consumer,'target')};
const run=args=>execFileSync('cargo',['+1.96.0',...args],{cwd:scratch,env,encoding:'utf8',timeout:600000,maxBuffer:16<<20});
const metadata=JSON.parse(run(['metadata','--locked','--offline','--no-deps','--format-version','1','--manifest-path',consumer+'/Cargo.toml']));
for(const dependency of metadata.packages[0].dependencies){
  assert(realpathSync(dependency.path).startsWith(realpathSync(scratch)+'/admission/'),'consumer escapes source-free root');
}
const stdout=run(['run','--locked','--offline','--quiet','--manifest-path',consumer+'/Cargo.toml','--',join(scratch,'admission/current-v2-next/packages'),join(scratch,roots.find(x=>x.id==='wasmc-data-core').root)]);
const execution=JSON.parse(stdout.trim().split('\n').at(-1));assert.equal(execution.accepted,true);assert.equal(execution.packages,5);
assert.deepEqual(inventory(scratch),before,'consumer changed its isolated source inputs');
const receipt={schema:'wasmc.current-v2-source-free-sdk/v1',accepted:true,
  oracle_sha256:sha(readFileSync(fileURLToPath(import.meta.url))),
  isolated_files:before,packages:5,provider_sources_present:false,private_compiler_sources_present:false,
  upstream_semantic_sources_present:false,engine_dependencies:'public cached Cargo registry; not copied into isolated consumer tree',
  offline:true,locked:true,execution,ordinary_wasmc_app_qualified:false,release_qualified:false};
if(save)writeFileSync(join(root,'admission/current-v2-next/source-free-sdk.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({accepted:true,packages:5,isolated_files:expectedFiles.length,source_free_sdk_execution:true,execution,release_qualified:false}));
