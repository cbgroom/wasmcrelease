import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentV3ProductInputsForVersion,validateCurrentCompilerBytes} from './release-candidate.mjs';
import {compilerCarrierCheck} from './ci-suite.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const leb=n=>{const a=[];do {let x=n&127;n=Math.floor(n/128);if(n)x|=128;a.push(x);}while(n);return Buffer.from(a);};
function moduleOfSize(total){
  // One valid custom section with an empty name; module size is exact.
  for(let w=1;w<=5;w++){
    const payload=total-9-w;if(payload<1)continue;const length=leb(payload);
    if(length.length===w)return Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0,0]),length,Buffer.alloc(payload)]);
  }
  throw Error('unrepresentable module size');
}
const check=(b,v)=>validateCurrentCompilerBytes(b,{bytes:b.length,sha256:sha(b)},v);
const legacy=moduleOfSize(2*1024*1024),afterLegacy=moduleOfSize(2*1024*1024+1);
const max=moduleOfSize(16*1024*1024),over=moduleOfSize(16*1024*1024+1);
check(legacy,'0.0.30');assert.throws(()=>check(afterLegacy,'0.0.30'),/byte budget/);
check(afterLegacy,'0.0.31');check(afterLegacy,'0.1.0');check(max,'0.0.31');assert.throws(()=>check(over,'0.0.31'),/byte budget/);
const boundaryPath='scripts/test-current-compiler-byte-boundary-v031.mjs';
assert.equal(currentV3ProductInputsForVersion('0.0.30').includes(boundaryPath),false);
assert.equal(currentV3ProductInputsForVersion('0.0.31').includes(boundaryPath),true);
assert.equal(currentV3ProductInputsForVersion('0.0.32').includes(boundaryPath),true);
for(const runtime of ['node','bun','deno']) {
  assert.equal(compilerCarrierCheck('0.0.30',runtime),null);
  for(const version of ['0.0.31','0.0.32','0.1.0']) {
    const test=compilerCarrierCheck(version,runtime);
    assert.equal(test.id,'current-compiler-byte-boundary');
    assert.equal(test.command,runtime);
    assert.ok(test.args.includes(boundaryPath));
  }
}
// Run the real integrity checker up to its custody boundary in an isolated
// fixture. The remaining custody/manifest checks are not simulated here.
const root=fileURLToPath(new URL('../',import.meta.url)),temp=mkdtempSync(join(tmpdir(),'wasmc-compiler-integrity-cap-'));
try {
 mkdirSync(join(temp,'scripts'));mkdirSync(join(temp,'current'));
 copyFileSync(join(root,'scripts/compiler-source-diff-policy.mjs'),join(temp,'scripts/compiler-source-diff-policy.mjs'));
 const source=readFileSync(join(root,'scripts/current-compiler-integrity.mjs'),'utf8');
 const marker='// Canonical admission and the earlier measured build retain separate identities.';
 assert.equal(source.split(marker).length,2,'integrity prelude boundary');
 writeFileSync(join(temp,'scripts/prelude.mjs'),source.split(marker)[0]+'\nconsole.log(JSON.stringify({accepted:true,maxCompilerBytes}));\n');
 for(const [version,wasm,pass,limit] of [
   ['0.0.30',legacy,true,2097152],['0.0.30',afterLegacy,false,2097152],
   ['0.0.31',afterLegacy,true,16777216],['0.0.31',max,true,16777216],['0.0.31',over,false,16777216],
 ]){
  writeFileSync(join(temp,'current/wasmc_compiler.wasm'),wasm);
  writeFileSync(join(temp,'current/compiler-release.json'),JSON.stringify({version,compiler:{sha256:sha(wasm)}}));
  const result=spawnSync('node',[join(temp,'scripts/prelude.mjs')],{encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH}});
  if(pass){assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).maxCompilerBytes,limit);}
  else {assert.notEqual(result.status,0);assert.match(result.stderr,/compiler exceeds version byte budget/);}
 }
} finally {rmSync(temp,{recursive:true,force:true});}
assert.throws(()=>validateCurrentCompilerBytes(max,{bytes:max.length,sha256:'0'.repeat(64)},'0.0.31'),/identity/);
const imported=Buffer.from([0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,7,1,1,120,1,102,0,0]);
assert.throws(()=>check(imported,'0.0.31'),/imports forbidden/);
assert.throws(()=>check(Buffer.from([0,97,115,109]),'0.0.31'));
console.log(JSON.stringify({accepted:true,legacy_max:legacy.length,legacy_plus_rejected:true,successor_max:max.length,successor_plus_rejected:true,identity_import_and_invalid_module_rejected:true,integrity_prelude_version_boundaries:true}));
