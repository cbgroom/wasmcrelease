import assert from 'node:assert/strict';

function patch(version) {
  assert.equal(typeof version, 'string');
  const match = /^0\.0\.(0|[1-9][0-9]*)$/.exec(version);
  assert.ok(match, 'explicit canonical 0.0.patch release version required');
  const value = Number(match[1]);
  assert.ok(Number.isSafeInteger(value), 'release patch out of range');
  return value;
}

export const usesCurrentProductV3 = version => patch(version) >= 21;
export const requiresPrivateHelperQualification = version => patch(version) >= 23;
export const requiresCanonicalHostQualification = version => patch(version) >= 24;
export const requiresIfBranchScopeQualification = version => patch(version) >= 25;
export function currentCompatibilityPath(version) {
  assert.ok(usesCurrentProductV3(version), 'current v3 product version required');
  return `compatibility/core-artifacts-v0${patch(version)}.json`;
}

// Verify the complete recorded compiler cohort. This does not run tests or
// establish whole-product, platform, live-model or publication acceptance.
export function assertCompilerQualification(q, version, compilerSha256, manifestSha256) {
  assert.ok(usesCurrentProductV3(version));
  for (const value of [compilerSha256, manifestSha256]) assert.match(value, /^[0-9a-f]{64}$/);
  assert.equal(q.schema, 'wasmc.current-compiler-qualification/v1');
  assert.equal(q.accepted, true); assert.equal(q.version, version);
  assert.equal(q.compiler_sha256, compilerSha256);
  assert.equal(q.product_manifest_sha256, manifestSha256);
  assert.equal(q.source_free, true); assert.equal(q.compiler_private_source_present, false);
  const helpers = requiresPrivateHelperQualification(version);
  const commands = ['scripts/test-current-compiler.mjs', 'examples/current/standard.mjs',
    'scripts/test-current-lib-api-v021.mjs', ...(helpers ? ['scripts/test-current-private-helpers.mjs'] : []),
    ...(requiresCanonicalHostQualification(version) ? ['scripts/test-canonical-host-sdk.mjs'] : []),
    ...(requiresIfBranchScopeQualification(version) ? ['scripts/test-if-branch-scope.mjs'] : [])];
  assert.equal(q.runs.length, commands.length * 3);
  assert.deepEqual([...new Set(q.runs.map(r => r.engine))].sort(), ['bun', 'deno', 'node']);
  assert.equal(q.rejection_controls.exit_code, 0);
  assert.equal(q.rejection_controls.result.accepted, true);
  assert.equal(q.rejection_controls.result.actual_rejections, 6);
  assert.equal(q.rejection_controls.result.restored, true);
  for (const engine of ['node', 'bun', 'deno']) {
    const runs = q.runs.filter(r => r.engine === engine);
    assert.equal(runs.length, commands.length);
    assert.deepEqual(runs.map(r => r.args.at(-1)).sort(), [...commands].sort());
    assert.equal(new Set(runs.map(r => r.version)).size, 1);
    for (const r of runs) {
      assert.equal(r.exit_code, 0); assert.equal(r.result.accepted, true);
      assert.ok(typeof r.version === 'string' && r.version.length > 0);
    }
    const result = command => runs.find(r => r.args.at(-1) === command).result;
    const compiler = result(commands[0]);
    assert.equal(compiler.compiler_sha256, compilerSha256);
    assert.equal(compiler.frozen_outputs, 35); assert.equal(compiler.execution_oracles, 7); assert.equal(compiler.cli_outputs, 25);
    const std = result(commands[1]);
    assert.equal(std.standard_lib, 'wasmc:std@1.4.1'); assert.equal(std.functions, 73); assert.equal(std.consumer_calls, 7680);
    const managed = result(commands[2]);
    assert.equal(managed.provider, requiresCanonicalHostQualification(version) ? '4.9.1' : '4.9.0'); assert.equal(managed.compileLib_oracles, 3);
    assert.equal(managed.instantiateLib_oracles, 3); assert.equal(managed.calls, 768); assert.equal(managed.old_provider_fallback, false);
    if (helpers) {
      assert.equal(managed.boolean_conditional_calls, 1536); assert.equal(managed.boolean_numeric_rejections, 6);
      const h = result(commands[3]);
      for (const [key, value] of Object.entries({source_cases:20, guest_calls:66, repeats_per_instance:3,
        basic_scalar_types:11, long_helper_terms:2098, invalid_sources_rejected:5, selected_guest_trap:true,
        healthy_after_rejections:true, imports:0, real_MCP_acceptance:false})) assert.equal(h[key], value, key);
    }
    if (requiresCanonicalHostQualification(version)) {
      const c = result('scripts/test-canonical-host-sdk.mjs');
      assert.equal(c.compiler_sha256, compilerSha256);
      assert.equal(c.compiled_frames, 4); assert.equal(c.modules_per_frame, 8);
      assert.equal(c.native_parity, '89b0b692492e3bc65603a6f2788de8030dc272170bde0bbd903679e1621da03a');
      assert.equal(c.rejection_then_recovery, true); assert.equal(c.source_rebinding, true);
      assert.equal(c.real_Host_invocation, false);
    }
    if (requiresIfBranchScopeQualification(version)) {
      const s = result('scripts/test-if-branch-scope.mjs');
      assert.equal(s.accepted, true); assert.equal(s.compiler_sha256, compilerSha256);
      for (const [key,value] of Object.entries({source_cases:5,scalar_calls:1200,managed_calls:192,scope_rejections:24,carrier_forms:3})) assert.equal(s[key],value,key);
    }
  }
  if (helpers) {
    assert.equal(q.boolean_conditional_calls, 4608); assert.equal(q.boolean_numeric_rejections, 18);
    assert.equal(q.private_helper_guest_calls, 198);
  }
  return true;
}
