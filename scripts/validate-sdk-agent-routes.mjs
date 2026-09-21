#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(root,path),'utf8');
const exists=path=>existsSync(resolve(root,path));

const surfaces=JSON.parse(read('release-surfaces.json'));
assert.equal(surfaces.schema,'wasmc.release-surfaces/v1');
assert.match(surfaces.release_version??'',/^\d+\.\d+\.\d+$/);
const discovery=surfaces.agent_discovery;
assert(discovery,'release-surfaces.json missing agent_discovery');
assert.equal(discovery.entry_skill,'skills/wasmc-sdk-discovery/SKILL.md');
assert.equal(discovery.sdk_entry,'sdk/AGENTS.md');

const requiredFiles=[
  'AGENTS.md',
  'skills/wasmc-sdk-discovery/SKILL.md',
  'skills/wasmc-sdk-discovery/agents/openai.yaml',
  'sdk/AGENTS.md',
  'sdk/wasmc-core-runtime/SKILL.md',
  'sdk/wasmc-host/SKILL.md',
  'sdk/wasmc-native-compiler/SKILL.md',
  'skills/wasmc-developer/SKILL.md',
  'skills/wasmc-developer/references/rust-wasmtime.md',
  'sdk/wasmc-core-runtime/src/sdk.rs',
  'sdk/wasmc-core-runtime/src/limits.rs',
  'sdk/wasmc-host/src/lib.rs',
  'sdk/wasmc-native-compiler/src/main.rs'
];
for(const file of requiredFiles)assert(exists(file),'missing SDK Agent route: '+file);

const agents=read('AGENTS.md');
const sdkDiscovery=read(discovery.entry_skill);
const sdkDiscoveryMetadata=read('skills/wasmc-sdk-discovery/agents/openai.yaml');
const developer=read('skills/wasmc-developer/SKILL.md');
const rustGuide=read('skills/wasmc-developer/references/rust-wasmtime.md');
const coreSkill=read('sdk/wasmc-core-runtime/SKILL.md');
const hostSkill=read('sdk/wasmc-host/SKILL.md');
const nativeSkill=read('sdk/wasmc-native-compiler/SKILL.md');
const coreSdk=read('sdk/wasmc-core-runtime/src/sdk.rs');
const limits=read('sdk/wasmc-core-runtime/src/limits.rs');
const hostSdk=read('sdk/wasmc-host/src/lib.rs');
const nativeCli=read('sdk/wasmc-native-compiler/src/main.rs');

assert(agents.includes(discovery.entry_skill),'root AGENTS does not route SDK discovery');
assert(developer.includes('../wasmc-sdk-discovery/SKILL.md'),'developer Skill does not route SDK discovery');
assert(sdkDiscoveryMetadata.includes('display_name: "WAsmC SDK Discovery"'));
assert(sdkDiscoveryMetadata.includes('Use $wasmc-sdk-discovery'));

for(const [id,path] of Object.entries(discovery.component_skills)){
  assert(exists(path),'missing component Skill '+id+': '+path);
  assert(sdkDiscovery.includes(path),'SDK discovery does not route '+path);
}

const hostSurface=surfaces.consumer_surfaces.find(row=>row.id==='host-sdk');
assert(hostSurface,'host-sdk release surface missing');
assert(['candidate','published'].includes(hostSurface.status),'unexpected host-sdk status '+hostSurface.status);
assert(hostSurface.roots.includes('sdk/wasmc-host'));
assert(hostSurface.roots.includes('sdk/wasmc-core-runtime'));
if(hostSurface.status!=='published'){
  assert(hostSkill.includes('does not prove the SDK belongs to the'));
  assert(hostSkill.includes('current immutable release'));
  assert(hostSkill.includes('do not claim an older tag shipped it'));
  assert(agents.includes('does not retroactively add a candidate path'));
}

const nativeSurface=surfaces.consumer_surfaces.find(row=>row.id==='integrated-runtime-cli');
assert(nativeSurface?.roots.includes('sdk/wasmc-native-compiler'));
assert(nativeSkill.includes('does **not** tell users that this CLI automatically performs')||
       nativeSkill.includes('Do **not** tell users that this CLI automatically performs'));
assert(nativeCli.includes('WasmiEngine::default()'),'native CLI run path no longer visibly Wasmi');
assert(!nativeCli.includes('request_optimization('),'native CLI unexpectedly claims Core Runtime promotion path');

const nativeRuntime=surfaces.consumer_surfaces.find(row=>row.id==='native-runtime-library');
assert.equal(nativeRuntime?.status,'incubating');
assert(sdkDiscovery.includes('never invent one from `host/runtime` source'));

const components=surfaces.agent_discovery?.components;
assert(components,'agent_discovery.components missing');
assert.equal(components['core-runtime-sdk']?.release_status,'published');
assert.equal(components['core-runtime-sdk']?.skill,'sdk/wasmc-core-runtime/SKILL.md');
assert.equal(components['host-sdk']?.release_status,hostSurface.status);
assert.equal(components['host-sdk']?.immutable_example,'v'+surfaces.release_version);
assert.equal(components['host-sdk']?.skill,'sdk/wasmc-host/SKILL.md');
assert.equal(components['native-cli']?.release_status,'published');
assert.equal(components['native-cli']?.skill,'sdk/wasmc-native-compiler/SKILL.md');
assert.match(components['native-cli']?.binary_packaging??'',/not immutable release assets/i);
assert.equal(components['lightweight-embedding']?.release_status,'qualified-reference');
assert.equal(components['native-runtime-library']?.release_status,'incubating');

const intents=new Map((surfaces.agent_discovery?.intent_routes??[]).map(row=>[row.intent,row.component]));
assert.equal(intents.get('rust-core-execution'),'core-runtime-sdk');
assert.equal(intents.get('rust-generic-host'),'host-sdk');
assert.equal(intents.get('cli-run-build-native'),'native-cli');
assert.equal(intents.get('js-lightweight-host'),'lightweight-embedding');
assert.equal(intents.get('native-runtime-binary'),'native-runtime-library');
assert.equal(intents.get('reusable-capability'),'lib-discovery');

for(const surfaceId of ['host-sdk','integrated-runtime-cli','lightweight-embedding']){
  const surface=surfaces.consumer_surfaces.find(row=>row.id===surfaceId);
  assert(surface?.functional_workflows?.includes('sdk-agent-guidance.yml'),
    surfaceId+' must include SDK Agent guidance workflow');
}

for(const [symbol,source] of [
  ['CoreRuntimeSdk',coreSdk],
  ['request_optimization',coreSdk],
  ['wait_for_optimization',coreSdk],
  ['pub fn publish',coreSdk],
  ['CoreRuntimeLimitProfile::unbounded()',coreSdk],
  ['pub const fn bounded',limits],
  ['pub fn native(',hostSdk],
  ['pub fn native_strict(',hostSdk],
  ['pub fn runtime_config(',hostSdk],
  ['pub fn grant_resource(',hostSdk]
])assert(source.includes(symbol),'documented SDK symbol missing in source: '+symbol);

for(const required of [
  'CoreRuntimeSdk',
  'request_optimization',
  'artifact.publish',
  'CoreRuntimeLimitProfile'
])assert(rustGuide.includes(required),'Rust guide missing current API: '+required);

for(const stale of ['WasmtimeHostSdk','WasmtimeHostLimits','prepare_lib_bundle']){
  assert(!rustGuide.includes(stale),'Rust guide retains stale API: '+stale);
}

assert(coreSkill.includes('unbounded limit profile'),'Core SDK Skill must warn about unbounded defaults');
assert(hostSkill.includes('HostBindPolicy::Safe'),'Host SDK Skill must name the authority policy surface');
assert(hostSkill.includes('automatic Host authority'),'Host SDK Skill must explain authority scope');
assert(hostSkill.includes('CoreRuntimeLimitProfile'),'Host SDK Skill must route execution limits');
assert(nativeSkill.includes('Wasmi'),'native CLI Skill must state run engine');

const hosting=read('HOSTING.md');
assert(!hosting.startsWith('# Hosting wasmc v0.0.8'),'HOSTING title is pinned to stale release');
assert(!hosting.includes('outer immutable `v0.0.5` Git tag'),'HOSTING retains stale outer tag guidance');

console.log(JSON.stringify({
  accepted:true,
  schema:'wasmc-sdk-agent-routing/v1',
  host_sdk_status:hostSurface.status,
  native_runtime_status:nativeRuntime.status,
  component_skills:Object.keys(discovery.component_skills).length,
  stale_api_names_rejected:3,
  source_symbols_verified:10,
  routes:{
    core_runtime:'sdk/wasmc-core-runtime/SKILL.md',
    host_sdk:'sdk/wasmc-host/SKILL.md',
    native_cli:'sdk/wasmc-native-compiler/SKILL.md',
    lightweight_embedding:'host/embedding/*'
  }
}));
