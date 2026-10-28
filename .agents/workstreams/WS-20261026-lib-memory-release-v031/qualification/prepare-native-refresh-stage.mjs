// Recover exact native authoring files from a fully verified candidate closure.
// This prepares a separate normal-refresh input, not a release or device proof.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader} from '../../../../scripts/current-lib-release-v3.mjs';
const [rootArg,assemblyPin,out]=process.argv.slice(2);
assert.ok(isAbsolute(rootArg??'')&&/^[a-f0-9]{64}$/.test(assemblyPin??'')&&isAbsolute(out??''));
assert.ok(!existsSync(out),'fresh output required');
const root=resolve(rootArg),read=currentProductReader(root),sha=b=>createHash('sha256').update(b).digest('hex');
const assemblyBytes=read('admission/current-composition-assembly-v1.json');assert.equal(sha(assemblyBytes),assemblyPin);
const assembly=JSON.parse(assemblyBytes);assert.equal(assembly.accepted,true);assert.equal(assembly.formal_release,false);
const catalogBytes=read('catalog/libs-current-v2.json');assert.equal(sha(catalogBytes),assembly.catalog_sha256);
const catalog=JSON.parse(catalogBytes);
const validate=spawnSync(process.execPath,[resolve(import.meta.dirname,'../../../../scripts/validate-lib-refresh-v2-source.mjs'),'--candidate-assembly-sha256',assemblyPin],{cwd:root,encoding:'utf8',timeout:120000});
assert.equal(validate.status,0,validate.stderr);assert.equal(JSON.parse(validate.stdout).accepted,true);
const schemas=new Set(['wasmc.current-native-source-only-producer-source/v1','wasmc.current-native-node-producer-source/v1','wasmc.current-native-c-producer-source/v1','wasmc.current-native-reused-c-producer-source/v1']);
const files=new Map(),entries=[],summary=[];
for(const row of catalog.packages){
  const projectedBytes=read(row.source.spec.path);assert.equal(sha(projectedBytes),row.source.spec.sha256);
  const projected=JSON.parse(projectedBytes);
  if(projected.schema==='wasmc.lib-refresh-source/v2'&&projected.profile==='native') {
    assert.equal(projected.id,row.id);assert.equal(projected.version,row.version);
    assert.equal(row.source.spec.path,`libspec/${row.id}/lib.json`);
    const names=['lib.json','lib.wit',...projected.native.files];assert.equal(new Set(names).size,names.length);
    const pins={};for(const name of names){assert.ok(!name.startsWith('/')&&!name.split('/').some(x=>x==='..'||x===''));
      const path=`libspec/${row.id}/${name}`,bytes=read(path);
      if(name==='lib.json')assert.equal(sha(bytes),row.source.spec.sha256);
      if(name==='lib.wit'){assert.equal(path,row.source.wit.path);assert.equal(bytes.length,row.source.wit.bytes);assert.equal(sha(bytes),row.source.wit.sha256);}
      files.set(path,bytes);pins[name]=sha(bytes);}
    entries.push({id:row.id,source:`libspec/${row.id}`});summary.push({id:row.id,version:projected.version,kind:projected.native.kind,target:projected.native.target,files:pins});
    continue;
  }
  if(!schemas.has(projected.schema))continue;
  assert.equal(projected.id,row.id);assert.equal(projected.profile,'native');
  const packet=projected.source_packet;assert.ok(packet&&Array.isArray(packet.files));
  const readPacket=name=>{assert.ok(!name.startsWith('/')&&!name.split('/').some(x=>x==='..'||x===''));
    const path=`${packet.root}/${name}`,pins=packet.files.filter(x=>x.path===path);assert.equal(pins.length,1,`unique pin ${path}`);
    const bytes=read(path);assert.equal(bytes.length,pins[0].bytes);assert.equal(sha(bytes),pins[0].sha256);return bytes;};
  const specBytes=readPacket('lib.json');assert.equal(projected.source_spec.path,`${packet.root}/lib.json`);
  assert.equal(specBytes.length,projected.source_spec.bytes);assert.equal(sha(specBytes),projected.source_spec.sha256);
  const spec=JSON.parse(specBytes);assert.equal(spec.schema,'wasmc.lib-refresh-source/v2');assert.equal(spec.id,row.id);
  assert.equal(spec.version,projected.version);assert.equal(spec.world,projected.world);assert.equal(spec.profile,'native');
  assert.deepEqual(spec.apis,projected.apis);assert.equal(spec.description,projected.description);
  assert.ok(Array.isArray(spec.native.files)&&new Set(spec.native.files).size===spec.native.files.length);
  const selectedWit=read(projected.wit.path),authoredWit=readPacket('lib.wit');
  assert.equal(selectedWit.length,projected.wit.bytes);assert.equal(sha(selectedWit),projected.wit.sha256);
  assert.deepEqual(authoredWit,selectedWit);
  const names=['lib.json','lib.wit',...spec.native.files];assert.equal(new Set(names).size,names.length);
  const pins={};for(const name of names){const bytes=readPacket(name);files.set(`libspec/${row.id}/${name}`,bytes);pins[name]=sha(bytes);}
  entries.push({id:row.id,source:`libspec/${row.id}`});summary.push({id:row.id,version:spec.version,kind:spec.native.kind,target:spec.native.target,files:pins});
}
const expected=['wasmc-system-android-display','wasmc-system-android-input','wasmc-system-android-ui','wasmc-system-android-uinput','wasmc-system-file-prototype','wasmc-system-ios-app-contacts','wasmc-system-ios-app-lifecycle','wasmc-system-ios-app-surface-control','wasmc-system-ios-background-audio','wasmc-system-ios-background-transfer','wasmc-system-ios-deferred-work','wasmc-system-ios-local-notification','wasmc-system-ios-network-path','wasmc-system-ios-simulator-display','wasmc-system-ios-websocket','wasmc-system-linux-endpoint','wasmc-system-linux-socket','wasmc-system-linux-uinput','wasmc-system-network-prototype','wasmc-system-process-prototype'];
assert.deepEqual(entries.map(x=>x.id).sort(),expected.sort());
const repo=resolve(import.meta.dirname,'../../../..'),inputs=join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs');
const policyBytes=readFileSync(join(inputs,'cohort-rust-policy.json'));assert.equal(sha(policyBytes),'a4d6c4ab47e2926e9eea81de33901b8383f1216c5af3457b99df83bed3ef2616');
const policy=JSON.parse(policyBytes);policy.edition='2024';policy.toolchain='stable';policy.shared_modules={};
const lock=readFileSync(join(inputs,'eight.Cargo.lock'));assert.equal(sha(lock),'9da7bf5fb19e18d1c2df034270a18b8cb2a6450aaf2fb2692ce911db27a155e5');
files.set('libspec/rust-policy.json',Buffer.from(JSON.stringify(policy,null,2)+'\n'));files.set('libspec/Cargo.lock',lock);
files.set('libspec/registry.json',Buffer.from(JSON.stringify({schema:'wasmc.lib-refresh-registry/v2',authority:'libspec',libs:entries},null,2)+'\n'));
for(const n of ['lib-refresh-v2.mjs','lib-refresh-runner-v2.mjs','lib-refresh-cache-v2.mjs','lib-refresh-native-v2.mjs','lib-refresh-resource-core-v2.mjs','lib-refresh-upstream-source-v2.mjs'])files.set(`scripts/${n}`,readFileSync(join(repo,'scripts',n)));
assert.equal(sha(read('admission/current-composition-assembly-v1.json')),assemblyPin);assert.equal(sha(read('catalog/libs-current-v2.json')),assembly.catalog_sha256);
mkdirSync(out);for(const [name,bytes] of files){const p=join(out,name);mkdirSync(resolve(p,'..'),{recursive:true});writeFileSync(p,bytes,{flag:'wx'});}
console.log(JSON.stringify({schema:'wasmc.native-refresh-stage/v1',assembly_sha256:assemblyPin,catalog_sha256:assembly.catalog_sha256,entries:summary,edition:'2024',output:out,device_qualification:false,formal_release:false}));
