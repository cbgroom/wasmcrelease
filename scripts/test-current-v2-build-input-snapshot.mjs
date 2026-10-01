import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,renameSync,symlinkSync,rmSync,copyFileSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {snapshotBuildInputs,verifyBuildInputsUnchanged,readCommittedBuildInput} from './current-v2-build-input-snapshot.mjs';
const temp=realpathSync(mkdtempSync(join(tmpdir(),'wasmc-input-witness-')));let rejected=0;
try{
  const workspace=join(temp,'workspace'),crate=join(workspace,'adapter');
  mkdirSync(join(crate,'src/target'),{recursive:true});mkdirSync(join(crate,'target'),{recursive:true});
  const inputs=new Map([
    ['LICENSE','fixture license'],['lib.wit','package fixture:input;'],
    ['workspace/lib.wit','package fixture:input;'],['workspace/lib.build.json','{}'],
    ['workspace/adapter/Cargo.toml','[package]\nname="fixture"\nversion="0.0.1"\n'],
    ['workspace/adapter/Cargo.lock','locked fixture'],
    ['workspace/adapter/src/lib.rs','pub fn fixture() {}'],
    ['workspace/adapter/src/target/module.rs','// source directory, not Cargo output'],
  ]);
  for(const [path,text]of inputs)writeFileSync(join(temp,path),text);
  writeFileSync(join(crate,'target/compiled-object'),'not an input');
  const before=snapshotBuildInputs(workspace,{siblingWit:true});
  assert.equal(Object.keys(before.files).length,8);
  assert(before.files['workspace/adapter/src/target/module.rs']);
  assert(!Object.keys(before.files).some(x=>x.includes('adapter/target/')));
  verifyBuildInputsUnchanged(workspace,before,{siblingWit:true});
  for(const [path,text]of inputs){
    writeFileSync(join(temp,path),text+' mutation');
    assert.throws(()=>verifyBuildInputsUnchanged(workspace,before,{siblingWit:true}));rejected++;
    writeFileSync(join(temp,path),text);
  }
  const lost=join(crate,'Cargo.lock');renameSync(lost,join(temp,'removed-lock'));
  assert.throws(()=>verifyBuildInputsUnchanged(workspace,before,{siblingWit:true}));rejected++;
  renameSync(join(temp,'removed-lock'),lost);
  const extra=join(crate,'build.rs');writeFileSync(extra,'fn main() {}');
  assert.throws(()=>verifyBuildInputsUnchanged(workspace,before,{siblingWit:true}));rejected++;
  rmSync(extra);
  const source=join(crate,'src/lib.rs');renameSync(source,join(temp,'source-target'));
  symlinkSync(join(temp,'source-target'),source);
  assert.throws(()=>snapshotBuildInputs(workspace,{siblingWit:true}));rejected++;
  rmSync(source);renameSync(join(temp,'source-target'),source);
  const alias=join(temp,'workspace-link');symlinkSync(workspace,alias);
  assert.throws(()=>snapshotBuildInputs(alias,{siblingWit:true}));rejected++;
  writeFileSync(join(crate,'target/compiled-object'),'changed output');
  assert.deepEqual(snapshotBuildInputs(workspace,{siblingWit:true}),before);
  for(const [path,text]of inputs)assert.equal(readFileSync(join(temp,path)).toString(),text);
  // Execute the actual builder entrypoint in a fresh public-only Git fixture.
  // Dirty input must reject before even touching a producer or output path.
  const publicRoot=join(temp,'public-fixture');mkdirSync(join(publicRoot,'scripts'),{recursive:true});
  for(const name of ['build-current-v2-portable.mjs','current-v2-build-input-snapshot.mjs'])
    copyFileSync(new URL('./'+name,import.meta.url),join(publicRoot,'scripts',name));
  const git=args=>execFileSync('git',['-C',publicRoot,...args],{stdio:'pipe'});
  git(['init','-q']);git(['add','scripts']);
  git(['-c','user.name=Witness fixture','-c','user.email=witness@example.invalid','commit','-qm','source witness fixture']);
  writeFileSync(join(publicRoot,'dirty-input'),'uncommitted');
  const producer=join(temp,'never-producer'),output=join(producer,'new-output');
  const attempt=spawnSync(process.execPath,[join(publicRoot,'scripts/build-current-v2-portable.mjs'),producer,output],
    {encoding:'utf8',timeout:10000});
  assert(!attempt.error);assert.equal(attempt.signal,null);assert.notEqual(attempt.status,0);
  assert.match(attempt.stderr,/public input tree must be clean/);assert.equal(existsSync(producer),false);rejected++;
  const large=Buffer.alloc(2*1024*1024,97);writeFileSync(join(publicRoot,'large-audit-input'),large);
  git(['add','large-audit-input']);git(['-c','user.name=Witness fixture','-c','user.email=witness@example.invalid','commit','-qm','large audit metadata fixture']);
  assert.deepEqual(readCommittedBuildInput(publicRoot,'HEAD','large-audit-input'),large);
  console.log(JSON.stringify({accepted:true,input_files:8,negative_controls:rejected,
    source_under_target_name_retained:true,cargo_output_excluded:true,readonly_witness:true,public_dirty_input_rejected:true,
    large_committed_input_bytes:large.length,historical_builds_attested:false,registry_source_integrity_attested:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true});} // Only this test's exact owned fixture.
