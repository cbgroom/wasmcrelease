import {generatedLib} from './generated-lib-v2.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const artifact=(await generatedLib('wasmc-data-relational')).artifact;

function run(command,args,options={}){
  const result=spawnSync(command,args,{
    cwd:options.cwd??root,
    encoding:'utf8',
    timeout:options.timeout??600000,
    maxBuffer:64<<20,
    env:{...process.env,...(options.env??{})},
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(command+' failed ('+result.status+'):\n'+result.stderr+'\n'+result.stdout);
  return result.stdout.trim();
}

const bytes=readFileSync(artifact);
const sha256=createHash('sha256').update(bytes).digest('hex');
const binary=process.platform==='win32'
  ? resolve(root,'tests/lib-refresh/qualification/wasmi-core/target/release/data_relational_v002.exe')
  : resolve(root,'tests/lib-refresh/qualification/wasmi-core/target/release/data_relational_v002');
run('cargo',['+1.96.0','build','--release','--locked','--manifest-path','tests/lib-refresh/qualification/wasmi-core/Cargo.toml','--bin','data_relational_v002']);
const output=run(binary,[],{env:{
  WASMC_GENERATED_DATA_RELATIONAL:artifact,
}});
const receipt=JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
assert.equal(receipt.accepted,true);
assert.equal(receipt.engine,'wasmi-2.0.0');
assert.equal(receipt.bytes,bytes.length);
assert.equal(receipt.imports,0);
assert.equal(receipt.instantiated,true);
assert.equal(receipt.exports_checked,7);
assert.deepEqual(receipt.new_exports,['distinct','window-offset','window-aggregate']);
assert.equal(receipt.semantic_scope,'structural-engine-qualification-only');
console.log(JSON.stringify({...receipt,artifact_sha256:sha256}));
