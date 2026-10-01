import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const bytes=path=>readFileSync(root+path),sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(bytes('admission/current-v2-next/ordinary-app.json'));
const batches=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json'];
const packages=batches.flatMap(path=>JSON.parse(bytes(path)).packages);
export function validateAppReceipt(value){
  assert.equal(value.schema,'wasmc.current-v2-ordinary-app-probe/v1');
  assert.equal(value.accepted,true);assert.equal(value.package_count,5);
  assert.equal(value.ordinary_app_qualified_count,1);assert.equal(value.blocked_count,4);
  for(const key of ['ordinary_wasmc_app_qualified','published_compiler_qualified','catalog_admitted','release_qualified'])assert.equal(value[key],false,key);
  assert.equal(value.producer.commit,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
  assert.equal(value.producer.configuration,'--lib --features core-runtime-sdk');
  assert.match(value.producer.compiler_rlib_sha256,/^[0-9a-f]{64}$/);
  assert.equal(value.oracle_sha256,sha(bytes('scripts/probe-current-v2-app.mjs')));
  assert.equal(value.helper_sha256,sha(bytes('libsrc/qualification/current-v2-app/compile.rs')));
  assert.deepEqual(value.observations.map(x=>x.id).sort(),packages.map(x=>x.id).sort());
  for(const observation of value.observations){
    const row=packages.find(x=>x.id===observation.id);
    assert.equal(observation.version,row.version);
    assert.equal(observation.manifest_sha256,sha(bytes(row.root+'/lib.json')));
    assert.equal(observation.artifact_sha256,sha(bytes(row.root+'/artifact.wasm')));
    assert.equal(observation.source_sha256,sha(Buffer.from(observation.source)));
    const clock=observation.id==='wasmc-host-clock';
    assert.equal(observation.compiled,clock);assert.equal(observation.ordinary_app_qualified,clock);
    if(clock){
      assert.equal(observation.app_sha256,sha(bytes('admission/current-v2-next/apps/host-clock.wasm')));
      assert.equal(observation.app_bytes,bytes('admission/current-v2-next/apps/host-clock.wasm').length);
      assert.equal(observation.source,bytes('admission/current-v2-next/apps/host-clock.wasmc').toString());
      assert.equal(observation.calls,640);assert.equal(observation.host_calls,640);
      assert.equal(observation.rounds,128);assert.equal(observation.diagnostic,'');
      for(const key of ['missing_host_rejected','non_function_host_rejected','missing_provider_rejected','host_failure_propagated'])assert.equal(observation[key],true);
    }else{
      assert.match(observation.diagnostic,/Core resolver v0 does not admit/);
      assert.match(observation.diagnostic,/no Component fallback was performed/);
      assert.equal(observation.rejection_stage,'namespace Core transport admission, before source-body type checking');
      assert.equal(observation.source_body_typechecked,false);
    }
  }
  return value.observations.find(x=>x.id==='wasmc-host-clock');
}
export async function executeClockApp(){
  const clock=validateAppReceipt(receipt);
  const row=packages.find(x=>x.id===clock.id);
  const provider=await WebAssembly.compile(bytes(row.root+'/artifact.wasm'));
  const app=await WebAssembly.compile(bytes('admission/current-v2-next/apps/host-clock.wasm'));
  // Bun additionally exposes function type metadata; compare the standard
  // descriptor fields rather than treating that extension as an extra import.
  const descriptors=module=>WebAssembly.Module.imports(module).map(({module,name,kind})=>({module,name,kind}));
  const providerImports=descriptors(provider),appImports=descriptors(app);
  assert.deepEqual(providerImports,clock.provider_imports);assert.deepEqual(appImports,clock.app_imports);
  await assert.rejects(WebAssembly.instantiate(provider,{}),TypeError);
  const hostModule=providerImports[0].module;
  await assert.rejects(WebAssembly.instantiate(provider,{[hostModule]:{now:1}}),WebAssembly.LinkError);
  await assert.rejects(WebAssembly.instantiate(app,{}),TypeError);
  let now=0,hostCalls=0;
  const providerInstance=await WebAssembly.instantiate(provider,{[hostModule]:{now:()=>{hostCalls++;return now;}}});
  const load=async instance=>{
    const imports={};for(const entry of appImports){imports[entry.module]??={};imports[entry.module][entry.name]=instance.exports[entry.name];}
    return WebAssembly.instantiate(app,imports);
  };
  const instance=await load(providerInstance);let calls=0;
  for(let round=0;round<128;round++)for(const offset of [0,1,-1,2147483647,-2147483648]){
    now=(1000+round)|0;assert.equal(instance.exports.run(offset),(now+offset)|0);calls++;
  }
  assert.equal(hostCalls,calls);
  const sentinel=new Error('host failure');
  const failureApp=await load(await WebAssembly.instantiate(provider,{[hostModule]:{now:()=>{throw sentinel;}}}));
  assert.throws(()=>failureApp.exports.run(0),error=>error===sentinel);
  return {accepted:true,ordinary_app_qualified_count:1,blocked_count:4,calls,host_calls:hostCalls,
    runtime:globalThis.Bun?`Bun ${Bun.version} WebAssembly`:globalThis.Deno?`Deno ${Deno.version.deno} WebAssembly`:`Node ${process.version} WebAssembly`,
    published_compiler_qualified:false,release_qualified:false};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  // Corrupt claims/identities independently; none can promote this partial probe.
  let rejected=0;
  for(const change of [
    x=>x.release_qualified=true,x=>x.ordinary_wasmc_app_qualified=true,
    x=>x.published_compiler_qualified=true,x=>x.catalog_admitted=true,
    x=>x.ordinary_app_qualified_count=5,x=>x.blocked_count=0,
    x=>x.producer.commit='0'.repeat(40),x=>x.oracle_sha256='0'.repeat(64),
    x=>x.helper_sha256='0'.repeat(64),x=>x.observations.pop(),
    x=>x.observations[0].artifact_sha256='0'.repeat(64),
    x=>x.observations[0].ordinary_app_qualified=true,
    x=>x.observations[0].source_body_typechecked=true,
    x=>x.observations.find(y=>y.compiled).app_sha256='0'.repeat(64),
    x=>x.observations.find(y=>y.compiled).host_calls=0,
  ]){const altered=structuredClone(receipt);change(altered);assert.throws(()=>validateAppReceipt(altered));rejected++;}
  console.log(JSON.stringify({...await executeClockApp(),negative_controls:rejected}));
}
