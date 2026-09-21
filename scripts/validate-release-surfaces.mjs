#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(root,path),'utf8');
const model=JSON.parse(read('release-surfaces.json'));
assert.equal(model.schema,'wasmc.release-surfaces/v1');

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
