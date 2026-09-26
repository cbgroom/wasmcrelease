#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(root,path),'utf8');
const model=JSON.parse(read('release-surfaces.json'));
assert.equal(model.schema,'wasmc.release-surfaces/v1');

const projection=model.agent_capability_projection;
const producerDelta=model.producer_capability_delta;
const learning=model.agent_learning_protocol;
const taskRoutes=model.agent_task_routes;
const quickstart=model.agent_learning_quickstart;
assert.equal(projection?.schema,'wasmc.release-agent-capabilities/v1');
assert.equal(projection?.product_release,'v'+model.release_version);
assert.equal(learning?.schema,'wasmc.fresh-agent-learning/v1');
assert.equal(learning?.path,'agent-evaluation/fresh-agent-learning-v1.json');
assert.equal(learning?.single_model_pass_is_controlled_pair_qualification,false);
assert.equal(learning?.wall_clock_is_standalone_release_gate,false);
assert(existsSync(resolve(root,learning.path)),'agent learning protocol is missing');
assert.equal(JSON.parse(read(learning.path)).schema,learning.schema);
assert.equal(quickstart?.schema,'wasmc.agent-quickstart/v1');
assert.equal(quickstart?.path,'agent-quickstart.json');
const quickstartModel=JSON.parse(read(quickstart.path));
assert.equal(quickstartModel.schema,quickstart.schema);
assert.equal(quickstartModel.routes['release-orientation'].compiler.sha256,taskRoutes['release-orientation'].compiler.sha256);
assert.equal(quickstartModel.routes['ordinary-source-positive'].result.core_sha256,taskRoutes['ordinary-source-pair'].oracle.core_sha256);
assert.equal(quickstartModel.routes['producer-release-u64-delta'].producer.commit,producerDelta.producer.commit);
assert.equal(quickstartModel.routes['library-first-selection'].artifact_sha256,taskRoutes['released-base64'].approval.artifact_sha256);
assert.deepEqual(quickstartModel.routes['library-first-selection'].states,taskRoutes['released-base64'].states);
assert.deepEqual(quickstartModel.routes['release-state-separation'].required_output_states,['qualified','admitted','released','discoverable','installable']);
assert.deepEqual(Object.keys(taskRoutes).sort(),['host-authority','ordinary-source-pair','release-orientation','released-base64','rule']);
assert.equal(taskRoutes['release-orientation'].immutable_release,'v'+model.release_version);
assert.equal(taskRoutes['release-orientation'].compiler.sha256,'93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90');
assert.equal(taskRoutes['ordinary-source-pair'].oracle.core_sha256,'55f3c7e3d09b564b89b8268299a69569a33b856b46405cb4c4dd51634afec84e');
assert.equal(taskRoutes['ordinary-source-pair'].run_command,'node examples/agent-quickstart/run-pair.mjs');
assert.equal(taskRoutes['released-base64'].package,'wasmc:std@1.4.0');
assert.equal(taskRoutes['released-base64'].product_release,'v'+model.release_version);
assert.equal(taskRoutes['released-base64'].states.installable,true);
assert.equal(taskRoutes['released-base64'].search_is_selection_authority,false);
assert.equal(taskRoutes['released-base64'].behavior_command,'node examples/base64/run.mjs');
assert.match(taskRoutes['released-base64'].resolve_command,/13fe84e7faf77467b45d97460e9cd9fa1ba7d17c17b0175fb16ce5d694c82d82/);
assert.match(taskRoutes['host-authority'].decision,/application-owned exact allowlist/);
assert.equal(projection?.guidance_scope?.included_in_immutable_tag,false);
assert.equal(projection?.guidance_scope?.product_bytes_changed,false);
assert.equal(projection?.function_shape?.result,'exactly one semantic value');
assert.match(projection?.function_shape?.multiple_logical_values??'',/tuple/);
assert.match(projection?.function_shape?.embedding_warning??'',/multiple Core lanes/);
assert.deepEqual(projection?.type_decisions?.ordinary_source_scalars?.spellings,
  ['s8','u8','s16','u16','s32','u32','i64','f32','f64','bool']);
assert.equal(projection?.type_decisions?.u64_ordinary_source?.status,'unsupported');
assert.match(projection?.type_decisions?.u64_ordinary_source?.alternative??'',/bounds and signedness/);
assert(projection?.type_decisions?.map?.unsupported_positions?.includes('direct-public-WIT-value-result'));
assert.match(projection?.type_decisions?.map?.alternative??'',/list<Entry<K,V>>/);
assert.equal(projection?.feature_decisions?.async_ordinary_source_or_lib,'unsupported');
assert.match(projection?.next_release_requirement??'',/immutable release/);
assert.equal(producerDelta?.schema,'wasmc.producer-release-delta/v1');
assert.equal(producerDelta?.producer?.commit,'94328ed760f93bf24b595a71facdcc773d43b762');
assert.equal(producerDelta?.producer?.status,'verified-master-implementation');
assert.equal(producerDelta?.producer?.validation?.strict_mst,true);
assert.deepEqual(producerDelta?.release?.states,{qualified:false,admitted:false,released:false,discoverable:false,installable:false});
assert.equal(producerDelta?.release?.v0_0_13_u64_ordinary_source,'unsupported');
assert.match(producerDelta?.adjacent_type_decisions?.u32??'',/already released/);
assert.match(producerDelta?.adjacent_type_decisions?.char??'',/not implemented/);

const expectedPlatforms=[
  ['linux-x86_64','ubuntu-24.04',true,'required'],
  ['linux-aarch64','ubuntu-24.04-arm',true,'required'],
  ['macos-x86_64','macos-15-intel',false,'legacy-optional'],
  ['macos-aarch64','macos-14',true,'required'],
  ['windows-x86_64','windows-2025',true,'required'],
  ['windows-aarch64','windows-11-arm',true,'required']
];
assert.deepEqual(
  model.desktop_platforms.map(row=>[row.id,row.runner,row.release_required,row.support_class]),
  expectedPlatforms
);
const requiredPlatforms=expectedPlatforms.filter(row=>row[2]);
const optionalPlatforms=expectedPlatforms.filter(row=>!row[2]);
assert.equal(requiredPlatforms.length,5);
assert.deepEqual(optionalPlatforms.map(row=>row[0]),['macos-x86_64']);

const consumerIds=[
  'lib-package',
  'host-sdk',
  'integrated-runtime-cli',
  'lightweight-embedding',
  'native-runtime-library'
];
const extensionIds=['driver-provider','remote-provider'];
assert.deepEqual(model.consumer_surfaces.map(row=>row.id),consumerIds);
assert.deepEqual(model.extension_surfaces.map(row=>row.id),extensionIds);

const allowedStatuses=new Set([
  'published','candidate','qualified-reference','incubating','architecture'
]);
const all=[...model.consumer_surfaces,...model.extension_surfaces];
const ids=new Set();
let roots=0,workflows=0;
for(const surface of all){
  assert(!ids.has(surface.id),'duplicate surface '+surface.id);
  ids.add(surface.id);
  assert(allowedStatuses.has(surface.status),surface.id+': invalid status');
  assert(Array.isArray(surface.roots)&&surface.roots.length,surface.id+': roots required');
  for(const path of surface.roots){
    const full=resolve(root,path);
    assert(existsSync(full),surface.id+': missing root '+path);
    assert(statSync(full).isDirectory()||statSync(full).isFile(),surface.id+': invalid root '+path);
    roots++;
  }
  const required=['published','candidate'].includes(surface.status);
  if(required)assert(surface.functional_workflows?.length,surface.id+': functional workflow required');
  for(const workflow of surface.functional_workflows??[]){
    assert(existsSync(resolve(root,'.github/workflows',workflow)),surface.id+': missing workflow '+workflow);
    workflows++;
  }
  for(const workflow of surface.performance_workflows??[]){
    assert(existsSync(resolve(root,'.github/workflows',workflow)),surface.id+': missing performance workflow '+workflow);
    workflows++;
  }
}

assert.equal(model.performance.canonical_workflow,'native-cli-perf.yml');
assert.equal(model.performance.comparison,'same-platform-only');
assert.equal(model.performance.cross_platform_absolute_gate,false);
assert.equal(model.performance.policy_source,'bench/manifest.json');
assert.equal(model.performance.required_platform_count,5);
assert.deepEqual(model.performance.optional_platforms,['macos-x86_64']);

const benchmark=JSON.parse(read(model.performance.policy_source));
const baseline=benchmark.relative_baseline_policy;
assert.equal(baseline.comparison,'same-platform-only');
assert(Number.isInteger(baseline.history_window)&&baseline.history_window>=1&&baseline.history_window<=20);
assert(Number.isInteger(baseline.minimum_history)&&baseline.minimum_history>=1&&baseline.minimum_history<=baseline.history_window);
assert(Number.isFinite(baseline.advisory_regression_ratio)&&baseline.advisory_regression_ratio>1);
assert.equal(baseline.hard_gate,false);

const externalBaseline=JSON.parse(read('bench/host-external-load.json'));
assert.equal(externalBaseline.schema,'wasmc-host-external-load-policy/v1');
assert.equal(externalBaseline.tool.name,'oha');
assert.equal(externalBaseline.tool.version,'1.16.0');
assert.deepEqual(externalBaseline.connections,[1,8,32]);
assert.equal(externalBaseline.history.comparison,'same-platform-only');
assert.equal(externalBaseline.history.hard_gate,false);
assert(model.performance.baselines.some(row=>row.workflow==='host-external-load.yml'&&row.policy_source==='bench/host-external-load.json'));

const sixRunners=expectedPlatforms.map(row=>row[1]);
for(const workflow of ['native-compiler.yml','native-cli-perf.yml','host-lib-e2e.yml','rust-host-sdk.yml','host-external-load.yml']){
  const text=read('.github/workflows/'+workflow);
  for(const runner of sixRunners)assert(text.includes(runner),workflow+': missing desktop runner '+runner);
}
const intelWorkflows=['host-file-io.yml','host-https-flywheel.yml','host-external-load.yml','host-lib-e2e.yml','host-memory.yml','host-network.yml','lib-source.yml','native-cli-perf.yml','native-compiler.yml','rust-host-sdk.yml','thin-host.yml'];
for(const workflow of intelWorkflows){
  const text=read('.github/workflows/'+workflow);
  assert(text.includes('macos-15-intel'),workflow+': legacy Intel runner missing');
  assert(text.includes('continue-on-error:'),workflow+': legacy Intel runner must be non-blocking');
}

const architecture=JSON.parse(read('host/architecture.json'));
assert.deepEqual(architecture.distribution_surfaces.consumer,consumerIds);
assert.deepEqual(architecture.distribution_surfaces.extension,extensionIds);

console.log(JSON.stringify({
  accepted:true,
  schema:model.schema,
  agent_capability_projection:projection.schema,
  producer_capability_delta:producerDelta.schema,
  consumer_surfaces:consumerIds.length,
  extension_surfaces:extensionIds.length,
  desktop_platforms:expectedPlatforms.length,
  required_desktop_platforms:requiredPlatforms.length,
  optional_desktop_platforms:optionalPlatforms.map(row=>row[0]),
  validated_roots:roots,
  workflow_references:workflows,
  performance_comparison:model.performance.comparison,
  performance_hard_gate:baseline.hard_gate
}));
