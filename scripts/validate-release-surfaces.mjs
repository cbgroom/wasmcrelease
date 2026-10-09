import { loadAgentRoutes } from './agent-routes.mjs';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildClosure} from './lib-route-closure.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p),'utf8'),json=p=>JSON.parse(read(p));
const sha=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const model=json('release-surfaces.json'),q=loadAgentRoutes(),compiler=json('current/compiler-release.json');
const closure=buildClosure(),catalog=json(closure.catalog.path),std=catalog.packages.find(r=>r.id==='wasmc-std');
const readiness=json('release-lib-route-readiness.json'),ecosystem=json('lib-ecosystem-control-plane.json');
assert.equal(model.schema,'wasmc.release-surfaces/v1');assert.equal(model.release_version,'0.0.21');
assert.equal(compiler.version,model.release_version);assert.equal(sha('current/wasmc_compiler.wasm'),compiler.compiler.sha256);
assert.deepEqual(q.routes['release-orientation'].compiler,{...compiler.compiler,imports:0});
assert.equal(q.routes['release-orientation'].facade.sha256,sha('current/wasmc.mjs'));
assert.equal(model.agent_capability_projection.product_release,'v'+model.release_version);
assert.equal(model.agent_capability_projection.function_shape.result,'exactly one semantic value');
assert.match(model.agent_capability_projection.function_shape.multiple_logical_values,/tuple/);
assert.match(model.agent_capability_projection.function_shape.embedding_warning,/multiple Core lanes/);
assert.deepEqual(model.agent_capability_projection.type_decisions.ordinary_source_scalars.spellings,['s8','u8','s16','u16','s32','u32','i64','u64','f32','f64','bool']);
assert.ok(model.agent_capability_projection.type_decisions.u64_ordinary_source.positions.includes('nested-source-payload'));
assert.ok(model.agent_capability_projection.type_decisions.map.unsupported_positions.includes('direct-public-WIT-value-result'));
assert.equal(model.agent_capability_projection.feature_decisions.async_ordinary_source_or_lib,'unsupported');
assert.equal(model.producer_capability_delta.release.compiler_sha256,compiler.compiler.sha256);
assert.equal(model.producer_capability_delta.release.compiler_source_authority,compiler.source_commit);
assert.equal(model.producer_capability_delta.release.ordinary_source_u64,'supported');
assert.match(q.routes['position-aware-capability-negative'].decision,/async.*map/i);
assert.equal(q.routes['position-aware-capability-negative'].generate_source,false);
assert.equal(q.routes['library-first-selection'].catalog_sha256,closure.catalog.sha256);
assert.equal(q.routes['library-first-selection'].artifact_sha256,std.delivery.artifact.sha256);
assert.equal(q.routes['library-first-selection'].wit_sha256,std.wit_sha256);
assert.equal(q.routes['library-first-selection'].exact_report.manifest_sha256,std.manifest_sha256);
assert.equal(q.routes['library-first-selection'].exact_report.root_inventory_sha256,std.root_inventory_sha256);
assert.match(q.routes['library-first-selection'].final_answer_policy,/behavior separately verified companion_sha256/);
assert.equal(q.routes['library-first-selection'].catalog_snapshot_carried_forward,false);
assert.deepEqual(q.routes['release-state-separation'].states,{qualified:false,admitted:false,released:false,discoverable:false,installable:false});
assert.equal(q.routes['release-state-separation'].exact_report.stop_reason,'wasmc-source-direct-resource-methods');
assert.equal(q.routes['release-state-separation'].exact_report.identity,'wasmc-system-telemetry@0.0.1');
assert.match(q.routes['host-authority-boundary'].decision,/application-owned exact allowlist/);
assert.equal(q.routes['dynamic-client-gateway'].product.surface_status,'incubating');
assert.equal(model.agent_learning_protocol.schema,'wasmc.fresh-agent-learning/v2');
assert.equal(model.agent_learning_protocol.path,'agent-evaluation/fresh-agent-learning-v2.json');
assert.equal(model.agent_learning_protocol.single_model_pass_is_controlled_pair_qualification,false);
assert.equal(json(model.agent_learning_protocol.path).schema,model.agent_learning_protocol.schema);
assert.equal(model.lib_ecosystem_control_plane.path,'lib-ecosystem-control-plane.json');
assert.equal(model.lib_ecosystem_control_plane.schema,'wasmc.lib-ecosystem-control-plane/v3');
assert.equal(ecosystem.schema,model.lib_ecosystem_control_plane.schema);
assert.equal(ecosystem.inventory.packages,42);assert.equal(ecosystem.inventory.native_source_packages,14);
assert.equal(ecosystem.route_closure.api_routes,236);assert.equal(ecosystem.route_closure.entries,278);
assert.equal(closure.release_bindings.length,42);assert.equal(closure.search_index.api_routes,236);assert.equal(closure.search_index.entries,278);
assert.equal(readiness.product.package_routes,42);assert.equal(readiness.product.api_routes,236);
assert.equal(readiness.product.formal_release_ready,readiness.product.blocking_conditions.length===0);
assert.equal(readiness.lifecycle_authority.current_release,'release.json');
assert.deepEqual(q.routes['release-lib-route-readiness'].product,readiness.product);
assert.deepEqual(model.agent_task_routes['release-lib-route-readiness'].product,readiness.product);
assert.deepEqual(model.agent_task_routes['released-base64'].exact_report,q.routes['library-first-selection'].exact_report);
assert.equal(model.agent_task_routes['release-orientation'].compiler.sha256,compiler.compiler.sha256);
assert.equal(model.agent_task_routes['ordinary-source-pair'].oracle.core_sha256,'55f3c7e3d09b564b89b8268299a69569a33b856b46405cb4c4dd51634afec84e');
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
  'native-runtime-library',
  'dynamic-client-gateway'
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
const intelWorkflows=['host-file-io.yml','host-https-flywheel.yml','host-external-load.yml','host-lib-e2e.yml','host-memory.yml','host-network.yml','native-cli-perf.yml','native-compiler.yml','rust-host-sdk.yml','thin-host.yml'];
for(const workflow of intelWorkflows){
  const text=read('.github/workflows/'+workflow);
  assert(text.includes('macos-15-intel'),workflow+': legacy Intel runner missing');
  assert(text.includes('continue-on-error:'),workflow+': legacy Intel runner must be non-blocking');
}

const libRefresh=read('.github/workflows/lib-refresh.yml');
assert.match(libRefresh,/lib-refresh-v2/);
assert.match(libRefresh,/receipt/);
const architecture=JSON.parse(read('host/architecture.json'));
assert.deepEqual(architecture.distribution_surfaces.consumer,consumerIds);
assert.deepEqual(architecture.distribution_surfaces.extension,extensionIds);

console.log(JSON.stringify({
  accepted:true,
  schema:model.schema,
  agent_capability_projection:model.agent_capability_projection.schema,
  producer_capability_delta:model.producer_capability_delta.schema,
  lib_ecosystem_control_plane:model.lib_ecosystem_control_plane.schema,
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
