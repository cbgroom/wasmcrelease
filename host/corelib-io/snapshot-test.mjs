import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {createCoreBytesProvider} from './provider.mjs';
const core=await readFile('standard/corelib/4.8.0/corelib.wasm');
assert.equal(createHash('sha256').update(core).digest('hex'),'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
const provider=await createCoreBytesProvider(core);
const caller=await provider.caller(await compile(await readFile('host/corelib-io/private-abi-guest.wasmc','utf8')));
let controls=0;
{
  let reads=0;const input=[];Object.defineProperty(input,0,{get(){reads++;return reads===1?7:256;}});
  const owner=provider.allocate(input);try{assert.equal(owner.run(caller),7n);assert.equal(reads,1);}finally{owner.release();}
  assert.equal(provider.count(),0);controls++;
}
for(const input of [Array(1),[256],[-1],[0.5],[NaN],Array(17).fill(1)]) {
  const before=provider.allocationCalls();
  assert.throws(()=>provider.allocate(input),e=>e===-5);assert.equal(provider.count(),0);assert.equal(provider.allocationCalls(),before);controls++;
}
console.log(JSON.stringify({accepted:true,core_bytes_snapshot_controls:controls,index_read_once:true,invalid_input_before_core_allocation:true,core_owned_resources_remaining:provider.count(),caller_scope:'reviewed_private_abi_conformance_only',portable_std_qualified:false}));
