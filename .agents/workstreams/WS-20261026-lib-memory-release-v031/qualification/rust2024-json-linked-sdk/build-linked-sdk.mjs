import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Separately named experimental build from one pinned generated SDK. No Root,
// private producer source, or application source is changed by this builder.
const args = process.argv.slice(2);
assert.ok(args.length === 3 || args.length === 5, 'provide both SDK_SHA and ROOT_SHA together');
const [sdkDir, root, out,
  expectedSdk = 'b08f6c6ce11a23162defcf130b1f65acb93fc6ba4f5db849618fbc9ae3d373cd',
  expectedRoot = 'd0dcc046018ac37523e079b0990e5427aac1b2220a0df5da5d4610a19dfc2af0',
] = args;
assert.ok(sdkDir && root && out, 'usage: build-linked-sdk SDK_DIR ROOT NEW_OUTPUT_DIR [SDK_SHA ROOT_SHA]');
assert.match(expectedSdk, /^[a-f0-9]{64}$/); assert.match(expectedRoot, /^[a-f0-9]{64}$/);
const hash = b => createHash('sha256').update(b).digest('hex');
const metadata = JSON.parse(readFileSync(join(sdkDir, 'sdk.json')));
const bytes = readFileSync(join(sdkDir, 'src/lib.rs'));
assert.equal(metadata.schema, 'wasmc.rust-core-sdk-edition2024-candidate/v1');
assert.equal(metadata.status, 'candidate-not-released');
assert.equal(metadata.edition, '2024');
assert.equal(hash(bytes), expectedSdk, 'independent SDK pin');
assert.equal(metadata.sdk_sha256, hash(bytes));
const manifestBytes = readFileSync(join(root, 'lib.json'));
assert.equal(hash(manifestBytes), metadata.root_manifest_sha256);
assert.equal(hash(manifestBytes), expectedRoot, 'independent Root pin');
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.bindings.rust_core.source.sha256, metadata.original_sdk_sha256, 'Root SDK predecessor');
const artifact = readFileSync(join(root, manifest.artifact.path));
assert.equal(hash(artifact), metadata.lib_artifact_sha256);
assert.equal(hash(artifact), manifest.artifact.sha256);
const license = readFileSync(join(sdkDir, 'LICENSE'));
assert.equal(hash(license), metadata.license_sha256);
let source = bytes.toString('utf8');
// Existing generated WIT-derived provider exports declare rawN. Bind each
// matching guest interface operation to its corresponding local bridge once,
// at SDK build time; never apply rewriting to an application submission.
const raw = [...source.matchAll(/#\[link_name="([^"#]+)#([^"#]+)"\]fn raw(\d+)\(/g)];
const bridges = new Map();
for (const [, iface, operation, index] of raw) {
  const key = `${iface}#${operation}`;
  assert.ok(!bridges.has(key), `duplicate bridge ${key}`);
  assert.equal((source.match(new RegExp(`fn __wasmc_canonical_bridge_${index}\\(`, 'g')) ?? []).length, 1);
  bridges.set(key, index);
}
assert.equal(bridges.size, 26);
const pattern = /#\[link\(wasm_import_module\s*=\s*"([^\"]+)"\)\]\s*unsafe extern "C"\s*\{\s*#\[link_name\s*=\s*"([^\"]+)"\]\s*fn (wit_import\d+)/g;
const found = new Set();
source = source.replace(pattern, (whole, iface, operation, name) => {
  const key = `${iface}#${operation}`, index = bridges.get(key);
  assert.notEqual(index, undefined, `unmatched guest import ${key}`);
  assert.ok(!found.has(key), `duplicate guest import ${key}`);
  found.add(key);
  return `unsafe extern "C" {\n            #[link_name = "__wasmc_canonical_bridge_${index}"]\n            fn ${name}`;
});
assert.equal(found.size, bridges.size);
assert.deepEqual([...found].sort(), [...bridges.keys()].sort());
const linked = Buffer.from(source);
mkdirSync(out); mkdirSync(join(out, 'src'));
writeFileSync(join(out, 'src/lib.rs'), linked, {flag:'wx'});
writeFileSync(join(out, 'LICENSE'), license, {flag:'wx'});
const receipt = {schema:'wasmc.rust-core-sdk-linked-candidate/v1', status:'candidate-not-released',
  edition:'2024', root_manifest_sha256:hash(manifestBytes), lib_artifact_sha256:hash(artifact),
  predecessor_sdk_sha256:hash(bytes), sdk_sha256:hash(linked), license_sha256:hash(license),
  bridge_count:found.size, operations:[...found].sort(), application_rewrite:false,
  note:'independent source-derived candidate; not WAsmC producer output or published Root'};
writeFileSync(join(out, 'sdk.json'), JSON.stringify(receipt,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify(receipt));
