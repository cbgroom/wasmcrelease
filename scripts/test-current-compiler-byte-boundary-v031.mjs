import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
assert.throws(()=>validateCurrentCompilerBytes(max,{bytes:max.length,sha256:'0'.repeat(64)},'0.0.31'),/identity/);
const imported=Buffer.from([0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,7,1,1,120,1,102,0,0]);
assert.throws(()=>check(imported,'0.0.31'),/imports forbidden/);
assert.throws(()=>check(Buffer.from([0,97,115,109]),'0.0.31'));
console.log(JSON.stringify({accepted:true,legacy_max:legacy.length,legacy_plus_rejected:true,successor_max:max.length,successor_plus_rejected:true,identity_import_and_invalid_module_rejected:true}));
