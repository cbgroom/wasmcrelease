#!/usr/bin/env node
import assert from 'node:assert/strict';
import { refresh } from './lib-refresh-runner-v2.mjs';

function packageManifest(spec, policy) {
  const dependencies = new Set(spec.dependencies ?? []);
  for (const name of spec.shared_modules ?? []) {
    assert.ok(policy.shared_modules?.[name], 'unknown shared module: ' + name);
    for (const key of policy.shared_modules[name].dependencies ?? []) dependencies.add(key);
  }
  const rows = ['wit-bindgen = ' + policy.wit_bindgen];
  for (const key of [...dependencies].sort()) {
    assert.ok(policy.dependencies[key], 'unknown dependency: ' + key);
    rows.push(key + ' = ' + policy.dependencies[key]);
  }
  return [
    '[package]', 'name = ' + JSON.stringify(spec.crate), 'version = ' + JSON.stringify(spec.version),
    'edition = ' + JSON.stringify(policy.edition), 'publish = false', '',
    '[lib]', 'crate-type = ["cdylib"]', '', '[dependencies]', ...rows, '',
  ].join('\n');
}

function workspaceManifest(entries, policy) {
  const profile = policy.release_profile;
  return ['[workspace]', 'resolver = "2"', 'members = [',
    ...entries.map(e => '  "crates/' + e.id + '",'), ']', '', '[profile.release]',
    'opt-level = ' + JSON.stringify(profile.opt_level), 'lto = ' + profile.lto,
    'codegen-units = ' + profile.codegen_units, 'panic = ' + JSON.stringify(profile.panic),
    'strip = ' + JSON.stringify(profile.strip), '',
  ].join('\n');
}

function libSource(spec, policy) {
  return [
    'wit_bindgen::generate!({', '    path: "wit",', '    world: ' + JSON.stringify(spec.world) + ',',
    ...((spec.wit_dependencies ?? []).length ? ['    generate_all,'] : []), '});', '',
    ...(spec.shared_modules ?? []).map(name => 'mod ' + policy.shared_modules[name].module + ';'),
    'mod delta;', 'mod adapter;', '', 'use adapter::Adapter;', 'export!(Adapter);', '',
  ].join('\n');
}

function buildSpec(spec, resourceCore = null) {
  return {
    apis: [...spec.apis].sort((a, b) => a.api < b.api ? -1 : a.api > b.api ? 1 : 0),
    rust: { artifact_name: spec.artifact_name, crate_dir: 'crates/' + spec.id, profile: 'wit-bindgen-component', ...(resourceCore ? { resource_core_source: resourceCore } : {}) },
    schema: 'wasmc.lib-build/v0', skill: { description: spec.description, name: spec.id, version: spec.version },
    wit: 'lib.wit',
  };
}

try {
  await refresh(process.argv.slice(2), {
    package: packageManifest, workspace: workspaceManifest, lib: libSource, spec: buildSpec,
  });
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
}
