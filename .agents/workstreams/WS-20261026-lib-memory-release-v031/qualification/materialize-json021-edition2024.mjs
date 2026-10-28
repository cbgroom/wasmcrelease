// Candidate-only materialization. The immutable source Root and released SDK
// stay untouched; a real producer change and release admission remain required.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [sourceArg, outputArg] = process.argv.slice(2);
assert(sourceArg && outputArg, 'usage: node materialize-json021-edition2024.mjs SOURCE_WORKTREE FRESH_OUTPUT');
const source = resolve(sourceArg), output = resolve(outputArg);
assert(!existsSync(output), 'output must not exist');
const sha = data => createHash('sha256').update(data).digest('hex');
const script = join(source, '.agents/workstreams/WS-20261026-lib-memory-json-v1/materialize-v021.mjs');
assert.equal(sha(readFileSync(script)), 'b94ab40983c00f53a9a8221167b70f0d804ddcb5db10d36b6d851bb83589caf5');
const expectedInputs = {
  'lib.json': '13bc7090f18cd062dd0a9acf67b1566d43969d5c8aeaf23823e679d77e14378f',
  'lib.wit': 'd8d7812950772a962736355082f6ca65db5ec0c8edf4565715746b54b29b621c',
  'delta.rs': '3281c64a97f1e10a802b82d99563a187f9f413abdcc7d982ff4ce3a3a4d43a79',
  'adapter.rs': '0d01813631d4dfb5a9dbc846756a0e7b678aa42da9bc1c098997e0deee1c7f22',
};
for (const [name, digest] of Object.entries(expectedInputs)) {
  assert.equal(sha(readFileSync(join(source, '.agents/workstreams/WS-20261026-lib-memory-json-v1/libspec/wasmc-json-v021', name))), digest);
}
assert.equal(sha(readFileSync(join(source, '.agents/workstreams/WS-20261026-lib-memory-json-v1/inputs/json007.Cargo.lock'))), '1f4a5ec0f3617d9a17cd19ef1cc31e1199ebedb9e7e62958a6ba4fab92fa01f6');
const policy = JSON.parse(readFileSync(new URL('./rust-glue-edition-policy.json', import.meta.url)));
assert.equal(policy.edition, '2024');
const result = spawnSync(process.execPath, [script, output], { encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const receipt = JSON.parse(readFileSync(join(output, 'source-receipt.json')));
assert.equal(receipt.schema, 'wasmc.lib-memory-materialization/v1');
assert.equal(receipt.version, '0.2.1');
assert.deepEqual(receipt.inputs, expectedInputs);
assert.equal(receipt.lock_sha256, '3ce3b65917c86aac618b321d37ee13d67b19c34702370c5b067198e7c3a44021');
const manifest = join(output, 'crates/wasmc-json/Cargo.toml');
const original = readFileSync(manifest, 'utf8');
assert.equal(original.split('edition = "2021"').length, 2);
const candidate = original.replace('edition = "2021"', `edition = "${policy.edition}"`);
writeFileSync(manifest, candidate);
assert.equal(sha(candidate), '768e4902adcc14884d1eab30a1b05d6e301769857ba64b1b10d57f310f99b12f');
const identity = { schema: 'wasmc.json-edition2024-candidate/v1', source_materializer_sha256: sha(readFileSync(script)), original_manifest_sha256: sha(original), candidate_manifest_sha256: sha(candidate), source_receipt: receipt, status: 'experimental-not-released' };
writeFileSync(join(output, 'edition2024-candidate.json'), `${JSON.stringify(identity, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ accepted: true, output, candidate_manifest_sha256: identity.candidate_manifest_sha256 }));
