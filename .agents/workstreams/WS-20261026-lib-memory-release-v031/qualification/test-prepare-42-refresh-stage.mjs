import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);assert.equal(args.length,8);
const script=resolve(import.meta.dirname,'prepare-42-refresh-stage.mjs'),temp=mkdtempSync(join(tmpdir(),'wasmc-42-stage-'));
const run=(a,out,...modes)=>spawnSync(process.execPath,[script,...a,out,...modes],{encoding:'utf8',timeout:120000});
try {
  const bad=[...args];bad[1]='0'.repeat(64);const badOut=join(temp,'bad-assembly');
  assert.notEqual(run(bad,badOut).status,0);assert.equal(existsSync(badOut),false);
  const invalid=[...args];invalid[3]='0'.repeat(64);const invalidOut=join(temp,'bad-native');
  assert.notEqual(run(invalid,invalidOut).status,0);assert.equal(existsSync(invalidOut),false);
  const out=join(temp,'good'),result=run(args,out);assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.entries.length,42);assert.deepEqual(receipt.excluded,['wasmc-std']);
  assert.equal(new Set(receipt.entries.map(x=>x.id)).size,42);assert.equal(receipt.formal_release,false);
  const normalized=join(temp,'qualified'),qualified=run(args,normalized,'qualified-json-metadata');assert.equal(qualified.status,0,qualified.stderr);
  const old=JSON.parse(readFileSync(join(out,'libspec/wasmc-json/lib.json'))),updated=JSON.parse(readFileSync(join(normalized,'libspec/wasmc-json/lib.json')));
  assert.equal(old.apis.length,26);assert.deepEqual(old.apis.map(x=>({...x,ecosystem:'Rust serde_json 1.0.151 and standard collections'})),updated.apis);
  for(const name of ['lib.wit','adapter.rs','delta.rs'])assert.deepEqual(readFileSync(join(out,'libspec/wasmc-json',name)),readFileSync(join(normalized,'libspec/wasmc-json',name)));
  const feature=join(temp,'raw-value'),enabled=run(args,feature,'qualified-json-metadata','enable-json-raw-value');assert.equal(enabled.status,0,enabled.stderr);
  const previous=JSON.parse(readFileSync(join(normalized,'libspec/rust-policy.json'))),policy=JSON.parse(readFileSync(join(feature,'libspec/rust-policy.json')));
  assert.equal(policy.dependencies.serde_json,'{ version = "=1.0.151", features = ["raw_value"] }');
  previous.dependencies.serde_json=policy.dependencies.serde_json;assert.deepEqual(previous,policy);
  assert.notEqual(run(args,out).status,0,'existing stage must not be overwritten');
  console.log('PASS 42-package stage, independent pins, exclusion and no overwrite');
} finally {rmSync(temp,{recursive:true,force:true});}
