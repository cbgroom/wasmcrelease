#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateUpstreamSourceContract } from './lib-refresh-upstream-source-v2.mjs';
import { inventory as fileInventory } from './lib-refresh-cache-v2.mjs';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
import {createHash} from 'node:crypto';

const root = process.cwd();
const registry = JSON.parse(await readFile(resolve(root, 'libspec/registry.json'), 'utf8'));
const policy = JSON.parse(await readFile(resolve(root, 'libspec/rust-policy.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.lib-refresh-registry/v2');
assert.equal(policy.schema, 'wasmc.lib-refresh-rust-policy/v2');
assert.ok((await stat(resolve(root, 'libspec/Cargo.lock'))).isFile());

const ids = registry.libs.map(row => row.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate Refresh V2 Lib id');
const inventory = ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit'];
const forbiddenDelta = [
  'wit_bindgen',
  'export!(',
  'core_abi',
  'wasmtime',
  'wasmi',
  'Store<',
  'Linker<',
];
const allowedProfiles = new Set(['value', 'resource', 'host', 'native']);
let originalProducerClosure=null,originalProducerSources=0,projectedProducerSources=0,verifiedSourcePackets=[];
const projectedSchemas=new Set([
  'wasmc.current-original-producer-source/v1','wasmc.current-published-producer-source/v1',
  'wasmc.current-built-rust-producer-source/v1','wasmc.current-wit-rebind-producer-source/v1',
  'wasmc.current-cohort-reexport-producer-source/v1','wasmc.current-reexported-rust-producer-source/v1',
  'wasmc.current-std-resource-producer-source/v1','wasmc.current-native-source-only-producer-source/v1',
  'wasmc.current-native-node-producer-source/v1','wasmc.current-native-c-producer-source/v1',
  'wasmc.current-native-reused-c-producer-source/v1',
]);
const args=process.argv.slice(2);
assert.ok(args.length===0||(args.length===2&&args[0]==='--candidate-assembly-sha256'&&/^[a-f0-9]{64}$/.test(args[1])),'invalid source validation options');
function verifiedOriginalProducerSource(row,spec){
  const read=currentProductReader(root);
  if(!originalProducerClosure){
    let admission;
    if(args.length){
      const bytes=read('admission/current-composition-assembly-v1.json');
      assert.equal(createHash('sha256').update(bytes).digest('hex'),args[1],'independent candidate assembly pin');
      const receipt=JSON.parse(bytes);assert.equal(receipt.schema,'wasmc.current-composition-assembly/v1');
      assert.equal(receipt.accepted,true);assert.equal(receipt.formal_release,false);assert.equal(receipt.fresh_builds,0);
      admission=receipt.closure;assert.equal(receipt.catalog_sha256,admission.catalog_sha256);
    }else admission=JSON.parse(read('admission/current-product-v3.json'));
    assert.equal(admission.schema,'wasmc.current-composition-release-closure/v1','original source requires independently retained composition closure');
    const bytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(bytes),cohort=JSON.parse(read(catalog.cohort.path));
    assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1');
    const paths=[...currentProductPaths(root),...currentProductPaths(root,cohort.input_prefix),
      ...catalog.packages.flatMap(item=>currentProductPaths(root,item.source.spec.path.slice(0,-'/lib.json'.length))),
      ...cohort.source_lineage.admitted_original_sources.flatMap(({source})=>
        [...currentProductPaths(root,source.root.locator),...currentProductPaths(root,source.source_packet.root)])];
    originalProducerClosure=verifyCurrentRelease(bytes,admission.catalog_sha256,read,paths);
    assert.deepEqual(originalProducerClosure,admission,'actual full base/source/Root lineage differs from independent closure');
    verifiedSourcePackets=cohort.source_lineage.admitted_original_sources.flatMap(({source})=>source.source_packet.files);
  }
  const catalog=JSON.parse(read('catalog/libs-current-v2.json')),selected=catalog.packages.find(item=>item.id===row.id);
  assert.ok(selected&&selected.source.spec.path===row.source+'/lib.json','original source must be a selected current registry identity');
  assert.deepEqual(JSON.parse(read(selected.source.spec.path)),spec,'actual selected original source');
  assert.equal(originalProducerClosure.fresh_full_q0,false);assert.equal(originalProducerClosure.original_receipt_bytes_verified,false);
}

for (const row of registry.libs) {
  assert.equal(row.source, 'libspec/' + row.id, row.id + ': source must use canonical libspec/<id>');
  const dir = resolve(root, row.source);
  const spec = JSON.parse(await readFile(join(dir, 'lib.json'), 'utf8'));
  if(projectedSchemas.has(spec.schema)){
    verifiedOriginalProducerSource(row,spec);
    assert.deepEqual(Object.keys(await fileInventory(dir)).sort(),['lib.json','lib.wit'],row.id+': exact admitted original-source projection');
    projectedProducerSources++;
    if(['wasmc.current-original-producer-source/v1','wasmc.current-published-producer-source/v1'].includes(spec.schema))originalProducerSources++;
    continue;
  }
  assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
  assert.equal(spec.id, row.id);
  assert.ok(allowedProfiles.has(spec.profile), row.id + ': invalid profile');
  if (spec.profile === 'host') {
    assert.ok(Array.isArray(spec.host_imports) && spec.host_imports.length > 0,
      row.id + ': host profile requires explicit imports');
    assert.equal(new Set(spec.host_imports).size, spec.host_imports.length,
      row.id + ': duplicate Host import');
  }
  if (spec.profile === 'native') {
    assert.ok(['c-boundary', 'node-boundary', 'swift-embedded'].includes(spec.native?.kind));
    assert.ok(spec.native.files.length && spec.native.files.includes(spec.native.entry));
    assert.ok(spec.native.files.every(p => p.startsWith('platform/')));
    assert.deepEqual(Object.keys(await fileInventory(dir)).sort(),
      ['lib.json', 'lib.wit', ...spec.native.files].sort(), row.id + ': native inventory drift');
    continue;
  }
  assert.deepEqual((await readdir(dir)).sort(), inventory, row.id + ': authored Rust inventory must stay exactly four files');
  assert.ok(Array.isArray(spec.apis) && spec.apis.length > 0, row.id + ': API evidence rows missing');
  for (const dependency of spec.dependencies ?? []) {
    assert.ok(policy.dependencies[dependency], row.id + ': dependency is outside shared policy: ' + dependency);
  }
  for (const sharedName of spec.shared_modules ?? []) {
    const shared = policy.shared_modules?.[sharedName];
    assert.ok(shared, row.id + ': shared module is outside shared policy: ' + sharedName);
    for (const dependency of shared.dependencies ?? []) {
      assert.ok(policy.dependencies[dependency], row.id + ': shared dependency is outside policy: ' + dependency);
    }
  }
  for (const dependencyId of spec.wit_dependencies ?? []) {
    assert.ok(ids.includes(dependencyId), row.id + ': unknown WIT dependency: ' + dependencyId);
  }
  const delta = await readFile(join(dir, 'delta.rs'), 'utf8');
  for (const token of forbiddenDelta) {
    assert.ok(!delta.includes(token), row.id + ': delta contains generated/runtime concern ' + token);
  }
  const adapter = await readFile(join(dir, 'adapter.rs'), 'utf8');
  const adapterLines = adapter.split('\n').length;
  const adapterLineBudget = 120 + 8 * spec.apis.length;
  assert.ok(adapterLines <= adapterLineBudget, row.id + ': adapter exceeds API-scaled review budget (' + adapterLines + '/' + adapterLineBudget + ' lines)');
  assert.ok(adapter.includes('crate::delta'), row.id + ': adapter must delegate into delta');
}
for (const [name, shared] of Object.entries(policy.shared_modules ?? {})) {
  assert.equal(Boolean(shared.source), !Boolean(shared.upstream_source), 'one current shared source authority required');
  if (shared.upstream_source) { validateUpstreamSourceContract(shared); continue; }
  let source;
  if(args.length&&!existsSync(resolve(root,shared.source))){
    assert.ok(originalProducerClosure,'candidate source lineage must be verified first');
    const suffix='/'+shared.source.replace(/^libspec\//,'');
    const pins=verifiedSourcePackets.filter(pin=>pin.path.endsWith(suffix));
    assert.ok(pins.length>0,'shared source missing from verified candidate packets: '+shared.source);
    const first=pins[0];assert.ok(pins.every(pin=>pin.bytes===first.bytes&&pin.sha256===first.sha256),'shared source packet drift');
    const bytes=currentProductReader(root)(first.path);
    assert.equal(bytes.length,first.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),first.sha256);
    source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }else source=await readFile(resolve(root, shared.source), 'utf8');
  for (const token of forbiddenDelta) {
    assert.ok(!source.includes(token), 'shared module ' + name + ' contains generated/runtime concern ' + token);
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.lib-refresh-source-validation/v2',
  libs: ids.length,
  inventory,
  shared_lock: true,
  authoring_authority: 'libspec',
  legacy_fallback: false,
  ...(projectedProducerSources?{original_producer_sources:originalProducerSources,projected_producer_sources:projectedProducerSources,
    composition_catalog_sha256:originalProducerClosure.catalog_sha256,fresh_full_q0:false,
    original_receipt_bytes_verified:false}:{}),
}));
