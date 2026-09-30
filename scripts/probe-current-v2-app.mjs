#!/usr/bin/env node
// Maintainer-only matching-producer probe. Never invoked by public CI.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [producerArg,save]=process.argv.slice(2);
assert(producerArg && (!save || save==='--receipt'),'usage: probe-current-v2-app.mjs PRIVATE_PRODUCER [--receipt]');
const producer=resolve(producerArg),sha=b=>createHash('sha256').update(b).digest('hex');
assert(!producer.startsWith(root+'/'),'private compiler must not enter public checkout');
const run=(cmd,args,cwd=producer)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:600000,maxBuffer:64<<20}).trim();
const commit=run('git',['rev-parse','HEAD']);
assert.equal(commit,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
assert.equal(run('git',['status','--porcelain']),'','producer must be clean');
// The resolver is exposed only with Wasmtime. Enable the existing dual-runtime
// profile; default Wasmtime-only currently has a separate feature-gating defect.
run('cargo',['+1.96.0','build','--locked','--offline','--lib','--features','core-runtime-sdk']);
const compiler=join(producer,'target/debug/libwasmc.rlib');
const scratch=mkdtempSync(join(producer,'target/current-v2-app-'));
const helper=join(root,'libsrc/qualification/current-v2-app/compile.rs');
const executable=join(scratch,'compile-app');
run('rustc',['+1.96.0','--edition=2021',helper,'--extern',`wasmc=${compiler}`,'-L',`dependency=${join(producer,'target/debug/deps')}`,'-o',executable]);
const batches=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json'];
const packages=batches.flatMap(path=>JSON.parse(readFileSync(join(root,path))).packages);
const catalog=join(scratch,'catalog');mkdirSync(catalog);
for(const row of packages)cpSync(join(root,row.root),join(catalog,row.id),{recursive:true});
writeFileSync(join(catalog,'catalog.json'),JSON.stringify({schema:'wasmc.lib-catalog/v0',entries:packages.map(p=>({id:p.id,version:p.version,path:p.id}))}));
const sources={
  'wasmc-host-clock':'package local:app; interface api { run: func(value: s32) -> s32 { return clock_api::sampled(value); } } world app { export api; }',
  'wasmc-owned-algorithms':'package local:app; interface api { run: func(values: list<s32>) -> s64 { return algorithms::sum_s32(values); } } world app { export api; }',
  'wasmc-http1':'package local:app; interface api { run: func(bytes: list<u8>) -> u32 { return wire::request_frame_length(bytes); } } world app { export api; }',
  'wasmc-resource-counter':'package local:app; interface api { run: func() -> s32 { return counters::value(); } } world app { export api; }',
  'wasmc-data-core':'package local:app; interface api { run: func() -> u32 { return model::validate(0); } } world app { export api; }',
};
const observations=[];
for(const row of packages){
  const source=sources[row.id],input=join(scratch,row.id+'.wasmc'),output=join(scratch,row.id+'-app.wasm');
  writeFileSync(input,source);
  const result=spawnSync(executable,[catalog,input,output],{encoding:'utf8',timeout:30000});
  assert(!result.error);assert.equal(result.signal,null);
  const expected=row.id==='wasmc-host-clock';assert.equal(result.status,expected?0:2,`${row.id}: ${result.stderr}`);
  const observation={id:row.id,version:row.version,source,source_sha256:sha(Buffer.from(source)),
    manifest_sha256:sha(readFileSync(join(root,row.root,'lib.json'))),
    artifact_sha256:sha(readFileSync(join(root,row.root,'artifact.wasm'))),compiled:expected,
    diagnostic:result.stderr.trim(),ordinary_app_qualified:false};
  if(!expected){
    assert.match(observation.diagnostic,/Core resolver v0 does not admit/);
    assert.match(observation.diagnostic,/no Component fallback was performed/);
    observation.rejection_stage='namespace Core transport admission, before source-body type checking';
    observation.source_body_typechecked=false;
  }else{
    const app=readFileSync(output),provider=readFileSync(join(root,row.root,'artifact.wasm'));
    const providerModule=await WebAssembly.compile(provider),appModule=await WebAssembly.compile(app);
    const providerImports=WebAssembly.Module.imports(providerModule),appImports=WebAssembly.Module.imports(appModule);
    assert.deepEqual(providerImports,[{module:'wasmc:host-clock/clock-host@0.0.1',name:'now',kind:'function'}]);
    assert.equal(appImports.length,1);assert.equal(appImports[0].name,'wasmc:host-clock/clock-api@0.0.1#sampled');
    const hostModule=providerImports[0].module;
    await assert.rejects(WebAssembly.instantiate(providerModule,{}),TypeError);
    await assert.rejects(WebAssembly.instantiate(providerModule,{[hostModule]:{now:1}}),WebAssembly.LinkError);
    await assert.rejects(WebAssembly.instantiate(appModule,{}),TypeError);
    let now=1000,hostCalls=0;
    const loaded=await WebAssembly.instantiate(providerModule,{[hostModule]:{now:()=>{hostCalls++;return now;}}});
    const imports={};for(const entry of appImports){imports[entry.module]??={};imports[entry.module][entry.name]=loaded.exports[entry.name];}
    const instance=await WebAssembly.instantiate(appModule,imports);
    let calls=0;
    for(let round=0;round<128;round++)for(const offset of [0,1,-1,2147483647,-2147483648]){
      now=(1000+round)|0;assert.equal(instance.exports.run(offset),(now+offset)|0);calls++;
    }
    assert.equal(hostCalls,calls);
    const sentinel=new Error('host failure');
    const failing=await WebAssembly.instantiate(providerModule,{[hostModule]:{now:()=>{throw sentinel;}}});
    const failureImports={};for(const entry of appImports){failureImports[entry.module]??={};failureImports[entry.module][entry.name]=failing.exports[entry.name];}
    const failureApp=await WebAssembly.instantiate(appModule,failureImports);
    assert.throws(()=>failureApp.exports.run(0),error=>error===sentinel);
    Object.assign(observation,{ordinary_app_qualified:true,app_sha256:sha(app),app_bytes:app.length,
      provider_imports:providerImports,app_imports:appImports,engine:`Node ${process.version} WebAssembly`,
      rounds:128,calls,host_calls:hostCalls,missing_host_rejected:true,non_function_host_rejected:true,
      missing_provider_rejected:true,host_failure_propagated:true});
  }
  observations.push(observation);
}
assert.equal(run('git',['status','--porcelain']),'');
const receipt={schema:'wasmc.current-v2-ordinary-app-probe/v1',accepted:true,
  oracle_sha256:sha(readFileSync(fileURLToPath(import.meta.url))),helper_sha256:sha(readFileSync(helper)),
  producer:{commit,configuration:'--lib --features core-runtime-sdk',toolchain:run('rustc',['+1.96.0','-Vv']),
    cargo_lock_sha256:sha(readFileSync(join(producer,'Cargo.lock'))),compiler_rlib_sha256:sha(readFileSync(compiler))},
  package_count:5,ordinary_app_qualified_count:1,blocked_count:4,observations,
  ordinary_wasmc_app_qualified:false,published_compiler_qualified:false,catalog_admitted:false,release_qualified:false};
if(save){
  const apps=join(root,'admission/current-v2-next/apps');mkdirSync(apps,{recursive:true});
  cpSync(join(scratch,'wasmc-host-clock-app.wasm'),join(apps,'host-clock.wasm'));
  writeFileSync(join(apps,'host-clock.wasmc'),sources['wasmc-host-clock']);
  writeFileSync(join(root,'admission/current-v2-next/ordinary-app.json'),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify(receipt));
