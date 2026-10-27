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
export const requiresUnusedHostImportsQualification = version => patch(version) >= 26;
export const requiresCheckedChunkQualification = version => patch(version) >= 27;
export const requiresUnitResultMatchQualification = version => patch(version) >= 28;
export const requiresCanonicalCheckedResultsQualification = version => patch(version) >= 29;
export const requiresStringStorageQualification = version => patch(version) >= 30;
export const currentStringQualificationScript = version => patch(version) >= 31 ? 'scripts/test-current-string-support-v031.mjs' : 'scripts/test-current-string-support.mjs';
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
    ...(requiresIfBranchScopeQualification(version) ? ['scripts/test-if-branch-scope.mjs'] : []),
    ...(requiresUnusedHostImportsQualification(version) ? ['scripts/test-canonical-host-import-demand.mjs'] : []),
    ...(requiresUnitResultMatchQualification(version) ? ['scripts/test-unit-result-match.mjs'] : []),
    ...(requiresCanonicalCheckedResultsQualification(version) ? ['scripts/test-canonical-checked-results.mjs'] : []),
    ...(requiresStringStorageQualification(version) ? [currentStringQualificationScript(version)] : [])];
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
    assert.equal(managed.provider, patch(version)>=31 ? '4.12.0-candidate.1' : requiresStringStorageQualification(version) ? '4.11.0-candidate.2' : requiresCheckedChunkQualification(version) ? '4.11.0-candidate.1' : requiresCanonicalHostQualification(version) ? '4.9.1' : '4.9.0'); assert.equal(managed.compileLib_oracles, 3);
    if(requiresCheckedChunkQualification(version))assert.equal(managed.provider_sha256,patch(version)>=31?'8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e':requiresStringStorageQualification(version)?'1fac280b1d3f2d82399e61e49fcb47f1c6ffc6c3d5b3b27e5d98059952fefabd':'b06eb9a32dddb75e278cd8aa9b1126f6e4b51e885a83897c80f7b5da85b81c3f');
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
      assert.equal(c.native_parity, requiresCheckedChunkQualification(version)
        ? '6c48c4bdade45afc63d2eaf372552bcdc85ac3f88c58fc4ce6866ec52ea1eecb'
        : requiresUnusedHostImportsQualification(version)
        ? 'd407267385d46f6ec4cdcd199fed5e2bc1320aea641140ac34b6b63014fe1c1f'
        : '89b0b692492e3bc65603a6f2788de8030dc272170bde0bbd903679e1621da03a');
      if(requiresCheckedChunkQualification(version))assert.equal(c.checked_chunk_profile,true);
      assert.equal(c.rejection_then_recovery, true); assert.equal(c.source_rebinding, true);
      assert.equal(c.real_Host_invocation, false);
    }
    if (requiresUnusedHostImportsQualification(version)) {
      const demand = result('scripts/test-canonical-host-import-demand.mjs');
      assert.equal(demand.compiler_sha256, compilerSha256);
      for (const [key,value] of Object.entries({cases:3,static_imports:13,json_read_imports:13,table_imports:18,modules_per_frame:8,exact_frame_pins:true,real_Host_invocation:false})) assert.equal(demand[key],value,key);
    }
    if (requiresStringStorageQualification(version)) {
      const text = result(currentStringQualificationScript(version));
      assert.equal(text.compiler_sha256,compilerSha256);
      assert.equal(text.CoreLib_sha256,patch(version)>=31?'8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e':'1fac280b1d3f2d82399e61e49fcb47f1c6ffc6c3d5b3b27e5d98059952fefabd');
      assert.equal(text.compiled_frames,4);assert.equal(text.modules_per_frame,8);assert.equal(text.Root_APIs,30);
      if(engine==='bun'){assert.equal(text.Guest_calls,0);assert.equal(text.execution_profile,'compiler-frames-only');}
      else if(patch(version)>=31){assert.equal(text.Guest_calls,583);assert.equal(text.same_instance_recovery,true);assert.equal(text.explicit_host_limit_rejected,true);assert.equal(text.Unicode_case_expansion,true);assert.deepEqual(text.large_input_bytes,[131072,262144,524288,1048576,1200000]);}
      else {assert.equal(text.Guest_calls,581);assert.equal(text.same_instance_recovery,true);assert.equal(text.canonical_ingress_work_budget_rejected,true);assert.equal(text.Unicode_case_expansion,true);assert.deepEqual(text.large_input_bytes,[131072,262144,524288]);}
    }
    if (requiresCanonicalCheckedResultsQualification(version)) {
      const checked = result('scripts/test-canonical-checked-results.mjs');
      assert.equal(checked.compiler_sha256,compilerSha256);
      if(engine==='bun'&&checked.app_engine_admitted===false){assert.equal(checked.guest_calls,0);assert.equal(checked.execution_profile,'compiler-frames-only');assert.equal(checked.unsupported_feature,'multi-memory');assert.equal(checked.compiled_frames,4);assert.equal(checked.http_only_imports,13);assert.equal(checked.old_cold_tuple_rejected,true);assert.equal(checked.modules_per_frame,8);assert.equal(checked.real_Host_effects,false);}else {
      assert.equal(checked.app_engine_admitted,true);
      for(const [key,value] of Object.entries({accepted:true,compiled_frames:4,modules_per_frame:8,http_only_imports:13,old_cold_tuple_rejected:true,guest_calls:800,same_instance:true,service_calls:800,response_drops:580,owned_error_drops:760,malformed_rejections:180,pending_counters_zero:3,fresh_dynamic_inputs:true,exact_error_case_decisions:5,rejection_then_recovery:true,real_Host_effects:false,business_Guest_executed:false}))assert.equal(checked[key],value,key);
      }
    }
    if (requiresUnitResultMatchQualification(version)) {
      const unit = result('scripts/test-unit-result-match.mjs');
      assert.equal(unit.accepted,true);assert.equal(unit.compiler_sha256,compilerSha256);
      for(const [key,value]of Object.entries({source_cases:4,guest_calls:1152,host_effects:1280,error_handles_dropped:384,malformed_traps:640,negative_sources_rejected:6,same_instance_recovery:true,live_handles:0,real_Host_effects:false}))assert.equal(unit[key],value,key);
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
