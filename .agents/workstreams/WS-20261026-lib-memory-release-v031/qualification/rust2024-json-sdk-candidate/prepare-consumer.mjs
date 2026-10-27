import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const policy=JSON.parse(readFileSync(new URL('../rust-glue-edition-policy.json',import.meta.url)));
assert.equal(policy.schema,'wasmc.rust-glue-edition-policy-candidate/v1');
assert.equal(policy.edition,'2024');

// One already-built SDK and one installed Root; no Cargo or SDK rewriting.
const [sdkDir,root,businessPath,expectedSdkHash,outPath]=process.argv.slice(2);
if(!sdkDir||!root||!businessPath||!expectedSdkHash||!outPath) throw Error('usage: prepare-consumer <sdk-dir> <installed-root> <business.rs> <sdk-sha256> <new-output.rs>');
assert.match(expectedSdkHash,/^[0-9a-f]{64}$/);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pkg=JSON.parse(readFileSync(join(sdkDir,'sdk.json')));
assert.equal(pkg.schema,'wasmc.rust-core-sdk-edition2024-candidate/v1');
assert.equal(pkg.status,'candidate-not-released');assert.equal(pkg.edition,policy.edition);
const sdk=readFileSync(join(sdkDir,'src/lib.rs'));
assert.equal(sha(sdk),expectedSdkHash,'independently selected SDK');
assert.equal(pkg.sdk_sha256,expectedSdkHash,'SDK package pin');
assert.equal(sha(readFileSync(join(sdkDir,'LICENSE'))),pkg.license_sha256,'SDK license');
const rootBytes=readFileSync(join(root,'lib.json'));
assert.equal(sha(rootBytes),pkg.root_manifest_sha256,'installed Root identity');
const manifest=JSON.parse(rootBytes),lib=readFileSync(join(root,manifest.artifact.path));
assert.equal(sha(lib),pkg.lib_artifact_sha256,'installed Core identity');
assert.equal(manifest.artifact.sha256,pkg.lib_artifact_sha256,'Root Core pin');
assert.equal(manifest.bindings.rust_core.source.sha256,pkg.original_sdk_sha256,'SDK predecessor');
const business=readFileSync(businessPath),source=Buffer.concat([sdk,Buffer.from('\n'),business]);
writeFileSync(outPath,source,{flag:'wx'});
console.log(JSON.stringify({sdk_sha256:sha(sdk),root_manifest_sha256:sha(rootBytes),lib_sha256:sha(lib),business_sha256:sha(business),source_sha256:sha(source),edition:pkg.edition,uses_cargo:false,transforms_sdk:false}));
