import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {usesCurrentProductV3, requiresPrivateHelperQualification, requiresCanonicalHostQualification, requiresIfBranchScopeQualification, requiresUnitResultMatchQualification, requiresCanonicalCheckedResultsQualification, currentCheckedQualificationScript, requiresStringStorageQualification, currentStringQualificationScript, currentCompatibilityPath, assertCompilerQualification} from './current-release-version.mjs';
import {currentV3ProductInputsForVersion} from './release-candidate.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const q = JSON.parse(read('current/qualification.json'));
const compiler = JSON.parse(read('current/compiler-release.json'));
const check = value => assertCompilerQualification(value, compiler.version, compiler.compiler.sha256, hash(read('current/compiler-release.json')));
assert.equal(check(q), true);
// Validator-only synthetic successor: real execution receipts are produced separately.
const successor = structuredClone(q); successor.version = '0.0.31';
for (const run of successor.runs) {
  if (run.args.at(-1) === 'scripts/test-canonical-checked-results.mjs') run.args[run.args.length-1] = 'scripts/test-canonical-checked-results-v031.mjs';
  if (run.args.at(-1) === 'scripts/test-current-lib-api-v021.mjs') {
    run.result.provider = '4.12.0-candidate.1';
    run.result.provider_sha256 = '8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e';
  }
  if (run.args.at(-1) === 'scripts/test-current-string-support.mjs') {
    run.args[run.args.length-1] = 'scripts/test-current-string-support-v031.mjs';
    run.result.CoreLib_sha256 = '8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e';
    if (run.engine !== 'bun') {
      run.result.Guest_calls = 583; run.result.explicit_host_limit_rejected = true;
      run.result.large_input_bytes = [131072,262144,524288,1048576,1200000];
    }
  }
}
const checkSuccessor = value => assertCompilerQualification(value, '0.0.31', compiler.compiler.sha256, hash(read('current/compiler-release.json')));
assert.equal(checkSuccessor(successor), true);
const badSuccessor = structuredClone(successor);
badSuccessor.runs.find(r=>r.engine==='node' && r.args.at(-1)==='scripts/test-current-string-support-v031.mjs').result.large_input_bytes.pop();
assert.throws(()=>checkSuccessor(badSuccessor));

assert.equal(usesCurrentProductV3('0.0.20'), false);
for(const p of ['scripts/update-current-corelib.mjs','scripts/corelib-abi.mjs','scripts/test-current-string-support-v031.mjs','scripts/test-canonical-checked-results-v031.mjs']) {
  assert.equal(currentV3ProductInputsForVersion('0.0.30').includes(p),false);
  assert.equal(currentV3ProductInputsForVersion('0.0.31').includes(p),true);
}
for (const version of ['0.0.21', '0.0.22', '0.0.23', '0.0.100']) {
  assert.equal(usesCurrentProductV3(version), true);
  const path = currentCompatibilityPath(version);
  assert.equal(path, `compatibility/core-artifacts-v0${version.split('.')[2]}.json`);
  const paths = currentV3ProductInputsForVersion(version);
  assert.ok(paths.includes(path));
  assert.deepEqual(paths.filter(p => /^compatibility\/core-artifacts-v0[0-9]+\.json$/.test(p)), [path]);
}
assert.equal(requiresPrivateHelperQualification('0.0.22'), false);
assert.equal(requiresPrivateHelperQualification('0.0.23'), true);
assert.equal(requiresCanonicalHostQualification('0.0.23'), false);
assert.equal(requiresCanonicalHostQualification('0.0.24'), true);
assert.equal(requiresIfBranchScopeQualification('0.0.24'), false);
assert.equal(requiresIfBranchScopeQualification('0.0.25'), true);
assert.equal(requiresUnitResultMatchQualification('0.0.27'), false);
assert.equal(requiresUnitResultMatchQualification('0.0.28'), true);
assert.equal(currentCheckedQualificationScript('0.0.30'),'scripts/test-canonical-checked-results.mjs');
assert.equal(currentCheckedQualificationScript('0.0.31'),'scripts/test-canonical-checked-results-v031.mjs');
assert.equal(requiresCanonicalCheckedResultsQualification('0.0.28'), false);
assert.equal(requiresCanonicalCheckedResultsQualification('0.0.29'), true);
assert.equal(requiresStringStorageQualification('0.0.29'),false);assert.equal(requiresStringStorageQualification('0.0.30'),true);
assert.equal(currentStringQualificationScript('0.0.30'),'scripts/test-current-string-support.mjs');
assert.equal(currentStringQualificationScript('0.0.31'),'scripts/test-current-string-support-v031.mjs');
let rejected = 0;
for (const version of ['0.0.023', '0.0.23-dev.1', '../23', '0.1.0', '0.0.9007199254740992', null]) {
  assert.throws(() => usesCurrentProductV3(version)); rejected++;
}
const mutations = [
  x => x.runs.find(r => r.args.at(-1) === 'scripts/test-canonical-host-sdk.mjs').result.native_parity = 'c68796a617b5fd41447b8b9e0cec087407c755faac11404ae8c13d74a55f483c',
  x => x.runs.find(r => r.args.at(-1) === 'scripts/test-current-lib-api-v021.mjs').result.provider = '4.9.0',
  x => x.runs.pop(),
  x => x.runs.splice(x.runs.findIndex(r => r.args.at(-1) === 'scripts/test-current-private-helpers.mjs'), 1),
  x => x.runs[3] = structuredClone(x.runs[0]),
  x => x.runs[3].engine = 'other',
  x => x.runs[3].result.guest_calls--,
  x => x.runs[3].result.long_helper_terms--,
  x => x.runs[3].result.invalid_sources_rejected--,
  x => x.runs[3].result.selected_guest_trap = false,
  x => x.runs[3].result.healthy_after_rejections = false,
  x => x.runs[3].result.imports = 1,
  x => x.runs[3].exit_code = 1,
  x => x.runs[2].result.boolean_numeric_rejections--,
  x => x.runs[1].result.consumer_calls--,
  x => x.runs[0].result.execution_oracles--,
  x => x.runs[1].version = 'different',
  x => x.compiler_sha256 = '0'.repeat(64),
  x => x.product_manifest_sha256 = '0'.repeat(64),
  x => x.version = '0.0.22',
  x => x.source_free = false,
  x => x.compiler_private_source_present = true,
  x => x.rejection_controls.result.restored = false,
  x => x.private_helper_guest_calls--,
  x => x.boolean_conditional_calls--
];
if(requiresUnitResultMatchQualification(compiler.version)){mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-unit-result-match.mjs').result.guest_calls--);mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-unit-result-match.mjs').result.live_handles=1);}
if(requiresCanonicalCheckedResultsQualification(compiler.version)){mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-canonical-checked-results.mjs').result.guest_calls--);mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-canonical-checked-results.mjs').result.pending_counters_zero=0);}
if(requiresStringStorageQualification(compiler.version)){mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-current-string-support.mjs').result.Guest_calls--);mutations.push(x=>x.runs.find(r=>r.args.at(-1)==='scripts/test-current-string-support.mjs').result.CoreLib_sha256='0'.repeat(64));}
for (const mutate of mutations) {const changed = structuredClone(q); mutate(changed); assert.throws(() => check(changed)); rejected++;}
// Schema compatibility fixture, never written as historical execution evidence.
const legacy = structuredClone(q); legacy.version = '0.0.22';
legacy.runs = legacy.runs.filter(r => !['scripts/test-current-string-support.mjs', 'scripts/test-canonical-checked-results.mjs', 'scripts/test-unit-result-match.mjs', 'scripts/test-current-private-helpers.mjs', 'scripts/test-canonical-host-sdk.mjs', 'scripts/test-if-branch-scope.mjs', 'scripts/test-canonical-host-import-demand.mjs'].includes(r.args.at(-1)));
for (const r of legacy.runs.filter(r => r.args.at(-1) === 'scripts/test-current-lib-api-v021.mjs')) r.result.provider = '4.9.0';
assert.equal(assertCompilerQualification(legacy, '0.0.22', compiler.compiler.sha256, hash(read('current/compiler-release.json'))), true);
console.log(JSON.stringify({accepted:true, actual_current_receipt:true, legacy_schema_fixture:true, rejections:rejected, whole_product_admission:false}));
