import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Prototype for this exact generated Core SDK identity; no Cargo or producer rebuild.
const [root, businessPath, expectedManifest, outPath] = process.argv.slice(2);
if (!root || !businessPath || !expectedManifest || !outPath) throw Error('usage: prepare-rust-glue <installed-root> <business.rs> <manifest-sha256> <output.rs>');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = readFileSync(join(root, 'lib.json'));
assert.equal(sha(manifestBytes), expectedManifest, 'installed manifest identity');
const manifest = JSON.parse(manifestBytes);
const sdkInfo = manifest.bindings.rust_core;
assert.equal(sdkInfo.schema, 'wasmc.lib-rust-canonical-core-sdk/v1');
const sdk = readFileSync(join(root, sdkInfo.source.path));
assert.equal(sha(sdk), sdkInfo.source.sha256, 'generated Rust Core SDK');
assert.equal(sha(readFileSync(join(root, manifest.artifact.path))), manifest.artifact.sha256, 'installed Lib Core');
assert.equal(sdkInfo.artifact_sha256, manifest.artifact.sha256, 'SDK and Lib pairing');
// Rust 2024 requires explicit unsafe on generated extern blocks and export attributes.
// Adapt only the verified SDK, never the caller's business source.
let source = sdk.toString('utf8');
assert.ok(source.includes('extern crate self as wit_bindgen;'), 'expected generated SDK shape');
let externs = 0, exports = 0;
source = source.replace(/(?<!unsafe )extern\s+"C"\s*\{/g, () => { externs++; return 'unsafe extern "C" {'; });
source = source.replace(/#\[no_mangle\]/g, () => { exports++; return '#[unsafe(no_mangle)]'; });
const business = readFileSync(businessPath);
const output = Buffer.concat([Buffer.from(source), Buffer.from('\n'), business]);
writeFileSync(outPath, output, {flag:'wx'});
console.log(JSON.stringify({manifest_sha256:sha(manifestBytes),sdk_sha256:sha(sdk),lib_sha256:manifest.artifact.sha256,business_sha256:sha(business),source_sha256:sha(output),externs_adapted:externs,exports_adapted:exports,scope:'single generated Rust Core SDK prototype'}));
