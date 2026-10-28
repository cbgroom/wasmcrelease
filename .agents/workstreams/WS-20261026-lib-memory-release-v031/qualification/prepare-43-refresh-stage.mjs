// Extend a verified 42-Lib refresh with the selected Std resource packet.
// All outputs are isolated candidate inputs; this does not publish a release.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader} from '../../../../scripts/current-lib-release-v3.mjs';
const [assemblyRoot,assemblyPin,stage42,refreshReceipt,refreshPin,out]=process.argv.slice(2);
assert.ok([assemblyRoot,stage42,refreshReceipt,out].every(p=>isAbsolute(p??'')));
assert.ok([assemblyPin,refreshPin].every(x=>/^[a-f0-9]{64}$/.test(x??'')));assert.ok(!existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex'),read=currentProductReader(resolve(assemblyRoot));
const repo=resolve(import.meta.dirname,'../../../..'),receiptBytes=readFileSync(refreshReceipt);assert.equal(sha(receiptBytes),refreshPin);
const prior=JSON.parse(receiptBytes);assert.equal(prior.accepted,true);assert.equal(prior.selected.length,42);assert.ok(!prior.selected.includes('wasmc-std'));
const files=new Map();for(const [path,pin] of Object.entries(prior.source_digests)){
  assert.ok(!path.startsWith('/')&&!path.split('/').some(x=>!x||x==='..'));const bytes=readFileSync(join(stage42,path));assert.equal(sha(bytes),pin,`42 source drift ${path}`);files.set(path,bytes);
}
for(const [name,pin] of Object.entries(prior.generator_digests))assert.equal(sha(files.get(`scripts/${name}`)),pin);
const assemblyBytes=read('admission/current-composition-assembly-v1.json');assert.equal(sha(assemblyBytes),assemblyPin);
const assembly=JSON.parse(assemblyBytes);assert.equal(assembly.accepted,true);const catalogBytes=read('catalog/libs-current-v2.json');assert.equal(sha(catalogBytes),assembly.catalog_sha256);
const catalog=JSON.parse(catalogBytes),row=catalog.packages.find(x=>x.id==='wasmc-std');assert.ok(row);
const projectionBytes=read(row.source.spec.path);assert.equal(sha(projectionBytes),row.source.spec.sha256);
const projection=JSON.parse(projectionBytes);assert.equal(projection.schema,'wasmc.current-std-resource-producer-source/v1');assert.equal(projection.version,'1.5.2');
const check=spawnSync(process.execPath,[resolve(repo,'scripts/validate-lib-refresh-v2-source.mjs'),'--candidate-assembly-sha256',assemblyPin],{cwd:assemblyRoot,encoding:'utf8',timeout:120000});
assert.equal(check.status,0,check.stderr);assert.equal(JSON.parse(check.stdout).accepted,true);
const packet=projection.source_packet;function pinned(name){const path=`${packet.root}/${name}`;const pins=packet.files.filter(x=>x.path===path);assert.equal(pins.length,1,`missing packet file ${name}`);const b=read(path);assert.equal(b.length,pins[0].bytes);assert.equal(sha(b),pins[0].sha256);return b;}
const buildBytes=pinned('lib.build.json');assert.equal(projection.source_spec.sha256,sha(buildBytes));const build=JSON.parse(buildBytes);
assert.equal(build.schema,'wasmc.lib-build/v0');assert.equal(build.skill.name,'wasmc-std');assert.equal(build.skill.version,projection.version);assert.deepEqual(build.apis,projection.apis);
const packetReceipt=JSON.parse(pinned('packet-receipt.json'));assert.equal(packetReceipt.accepted,true);
assert.equal(packetReceipt.source_commit,'9b0e533a89df295be761c40f5a08c3998065e164');
const commitCheck=spawnSync('git',['cat-file','-e',`${packetReceipt.source_commit}^{commit}`],{cwd:repo});assert.equal(commitCheck.status,0,'public source checkpoint missing');
const cohort=JSON.parse(read(catalog.cohort.path));assert.equal(sha(read(catalog.cohort.path)),catalog.cohort.sha256);
const base=cohort.composition.base,prefix=cohort.input_prefix,baseCatalogBytes=read(`${prefix}/${base.catalog.path}`);assert.equal(sha(baseCatalogBytes),base.catalog.sha256);
const baseCatalog=JSON.parse(baseCatalogBytes),old=baseCatalog.packages.find(x=>x.id==='wasmc-std');assert.ok(old);
const baseSpecBytes=read(`${prefix}/${old.source.spec.path}`);assert.equal(sha(baseSpecBytes),old.source.spec.sha256);
const spec=JSON.parse(baseSpecBytes);assert.equal(spec.schema,'wasmc.lib-refresh-source/v2');assert.equal(spec.profile,'resource');
const wit=pinned('lib.wit');assert.equal(sha(wit),projection.wit.sha256);assert.deepEqual(wit,read(projection.wit.path));
const adapter=pinned('adapter.rs'),delta=pinned('delta.rs'),raw=build.rust.resource_core_source;
assert.equal(raw.target_profile,'portable-v0');assert.equal(raw.modules.length,1);assert.equal(raw.modules[0].module,'std-composite');
const graph=pinned('graph.json'),core=pinned('composite.wasm'),provider=pinned('provider.wasm');
assert.equal(sha(graph),raw.graph_sha256);assert.equal(sha(core),raw.modules[0].sha256);assert.equal(sha(provider),raw.provider.sha256);
assert.equal(JSON.parse(graph).wit.sha256,sha(wit));
spec.version=projection.version;spec.description=projection.description;spec.apis=projection.apis;
spec.crate=build.rust.artifact_name;spec.artifact_name=build.rust.artifact_name;
const {artifact,sha256,...providerIdentity}=raw.provider;
spec.core_resource={target_profile:raw.target_profile,provider:providerIdentity,exports:raw.exports};
files.set('libspec/wasmc-std/lib.json',Buffer.from(JSON.stringify(spec,null,2)+'\n'));files.set('libspec/wasmc-std/lib.wit',wit);
files.set('libspec/wasmc-std/adapter.rs',adapter);files.set('libspec/wasmc-std/delta.rs',delta);
const registry=JSON.parse(files.get('libspec/registry.json'));assert.equal(registry.libs.length,42);registry.libs.push({id:'wasmc-std',source:'libspec/wasmc-std'});
assert.equal(new Set(registry.libs.map(x=>x.id)).size,43);files.set('libspec/registry.json',Buffer.from(JSON.stringify(registry,null,2)+'\n'));
const inputRoot=realpathSync(join(assemblyRoot,packet.root));assert.equal(inputRoot,join(assemblyRoot,packet.root),'canonical Std resource packet required');
const resource={schema:'wasmc.lib-refresh-resource-core-inputs/v1',producer_sha256:prior.producer.sha256,source_commit:packetReceipt.source_commit,
  packages:[{id:'wasmc-std',root:inputRoot,wit_sha256:sha(wit),assembly:{target_profile:raw.target_profile,graph:'graph.json',graph_sha256:raw.graph_sha256,
    modules:[{module:'std-composite',artifact:'composite.wasm',sha256:raw.modules[0].sha256}],exports:raw.exports,
    provider:{...raw.provider,artifact:'provider.wasm'}}}]};
const resourceBytes=Buffer.from(JSON.stringify(resource,null,2)+'\n');files.set('resource-core-inputs.json',resourceBytes);
assert.equal(sha(read('admission/current-composition-assembly-v1.json')),assemblyPin);
mkdirSync(out);for(const [name,bytes] of files){const path=join(out,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
console.log(JSON.stringify({schema:'wasmc.43-refresh-stage/v1',assembly_sha256:assemblyPin,prior_refresh_sha256:refreshPin,entries:43,std_source_commit:packetReceipt.source_commit,
  std_wit_sha256:sha(wit),std_core_sha256:sha(core),std_provider_sha256:sha(provider),resource_manifest_sha256:sha(resourceBytes),output:out,
  provenance:'existing public Std packet and previously qualified composite; no new private Source admission',formal_release:false}));
