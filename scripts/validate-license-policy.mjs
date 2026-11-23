import assert from "node:assert/strict";
import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {collectStandaloneReleaseNotices} from './standalone-release-notices-v1.mjs';
import {isExactDeclaredNotice} from './declared-thirdparty-notices.mjs';
import {collectCurrentDeclaredThirdPartyNotices} from './current-license-policy-v3.mjs';
import {collectCurrentDeclaredThirdPartyNoticesV4} from './current-license-policy-v4.mjs';
import {checkedCurrentCatalog,currentProductPaths,hash} from './current-lib-release-v3.mjs';
import {collectFrozenV030Notices} from './frozen-v030-notices-v1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const policy = JSON.parse(await read("license-policy.json"));
assert.equal(policy.schema, "wasmc.license-policy/v1");
assert.equal(policy.applies_to, "repository material first added after v0.0.19 unless that material carries a different license notice");
assert.equal(policy.license, "WAsmC Research-Only Non-Commercial License 1.0");
assert.equal(policy.license_file, "LICENSE");
assert.equal(policy.source_available, true);
assert.equal(policy.open_source, false);
assert.equal(policy.commercial_use, false);
assert.equal(policy.production_use, false);
assert.deepEqual(policy.permissions, [
  "non-commercial research",
  "education",
  "evaluation",
  "reproducibility",
  "benchmarking",
]);
assert.equal(policy.commercial_license, "separate written agreement required");
assert.deepEqual(policy.frozen_product_exception, {
  version: "v0.0.19",
  license: "MIT",
  cargo_metadata: "MIT OR Apache-2.0",
  rule: "exact released product files and already published artifacts retain their accompanying licenses",
});
assert.match(policy.future_release_rule, /every included package manifest/);
assert.match(policy.immutable_prior_tags, /exact tag/);
assert.match(policy.immutable_prior_tags, /does not rewrite or revoke earlier grants/);
assert.equal(policy.check_command, "node scripts/validate-license-policy.mjs");

const license = await read("LICENSE");
assert.match(license, /^WAsmC Research-Only Non-Commercial License 1\.0$/m);
assert.match(license, /solely for Non-Commercial Research/);
assert.match(license, /Commercial use is not permitted without a separate written license/);
assert.match(license, /It is not an open-source license\./);
assert.match(license, /first added after the immutable\nv0\.0\.19 release/);
assert.match(license, /does not rewrite, narrow, or revoke any permission/);
assert.doesNotMatch(license, /Permission is hereby granted, free of charge/);

const contributing = await read("CONTRIBUTING.md");
assert.match(contributing, /External contributions are paused/);
assert.match(contributing, /do not submit a pull request/);

const nonCommercialCargoLicenseFiles = new Map([
  ["host/contract/v0/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/file/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/memory/rust/Cargo.toml", "../../../../LICENSE"],
  ["sdk/wasmc-core-runtime/Cargo.toml", "../../LICENSE"],
  ["sdk/wasmc-host/Cargo.toml", "../../LICENSE"],
  ["sdk/wasmc-native-compiler/Cargo.toml", "../../LICENSE"],
]);

for (const [relative, expected] of nonCommercialCargoLicenseFiles) {
  const manifest = await read(relative);
  assert.doesNotMatch(manifest, /^license\s*=/m, `${relative} grants an unexpected SPDX license`);
  assert.ok(manifest.split("\n").includes(`license-file = "${expected}"`), `${relative} is not bound to the research-only license`);
  await readFile(path.resolve(path.dirname(path.join(root, relative)), expected));
}

const frozenCargoManifests = new Set([
  "host/drivers/tcp/rust/Cargo.toml",
  "host/drivers/udp/rust/Cargo.toml",
]);

for (const relative of frozenCargoManifests) {
  const manifest = await read(relative);
  assert.ok(manifest.split("\n").includes('license = "MIT OR Apache-2.0"'), `${relative} no longer matches the frozen product license metadata`);
}

const maintainers = await read(".agents/MAINTAINERS.md");
assert.match(maintainers, /^## License boundary$/m);
assert.match(maintainers, /Material first added after v0\.0\.19/);
assert.match(maintainers, /Never rewrite its frozen product inventory/);

const catalogBytes = await readFile(path.join(root,'catalog/libs-current-v2.json'));
// The first parse only selects the versioned policy. Each collector then
// requires the policy's independent catalog pin and verifies the full graph.
const selected = checkedCurrentCatalog(catalogBytes,hash(catalogBytes));
const readDeclared = async relative => {
  let current=root;
  for(const segment of relative.split('/')){current=path.join(current,segment);assert.ok(!(await lstat(current)).isSymbolicLink(),`linked declared notice input rejected: ${relative}`);}
  const before=await lstat(current);assert.ok(before.isFile(),`regular declared notice input required: ${relative}`);
  const bytes=await readFile(current),after=await lstat(current);
  assert.ok(!after.isSymbolicLink()&&after.ino===before.ino&&after.size===before.size&&after.mtimeMs===before.mtimeMs,`declared notice input drift: ${relative}`);
  return bytes;
};
const cohortBytes=await readDeclared(selected.cohort.path);
assert.equal(cohortBytes.length,selected.cohort.bytes);assert.equal(hash(cohortBytes),selected.cohort.sha256);
const cohortSchema=JSON.parse(cohortBytes).schema;
let declaredNotices;
if(cohortSchema==='wasmc.mixed-current-cohort/v1') {
  const {collectMixedDeclaredNotices}=await import('./current-license-policy-mixed-v1.mjs');
  const noticePolicy=JSON.parse(await read('catalog/current-mixed-license-policy-v1.json'));
  declaredNotices=await collectMixedDeclaredNotices(catalogBytes,noticePolicy,readDeclared,currentProductPaths(root));
  const actual=(await walk(root)).map(p=>p.replaceAll(path.sep,'/')).filter(p=>!declaredNotices.has(p));
  for(const [noticePath,pin] of await collectFrozenV030Notices(readDeclared,actual)) {
    if(declaredNotices.has(noticePath))assert.deepEqual(declaredNotices.get(noticePath),pin,'duplicate notice authorities');
    declaredNotices.set(noticePath,pin);
  }
} else if(cohortSchema==='wasmc.public-current-refresh-cohort/v2') {
  const noticePolicy=JSON.parse(await read('catalog/current-v4-license-policy.json'));
  declaredNotices=await collectCurrentDeclaredThirdPartyNoticesV4(catalogBytes,noticePolicy,readDeclared,currentProductPaths(root));
  const actual=(await walk(root)).map(p=>p.replaceAll(path.sep,'/')).filter(p=>!declaredNotices.has(p));
  for(const [noticePath,pin] of await collectFrozenV030Notices(readDeclared,actual)) {
    if(declaredNotices.has(noticePath))assert.deepEqual(declaredNotices.get(noticePath),pin,'duplicate notice authorities');
    declaredNotices.set(noticePath,pin);
  }
} else {
  assert.ok(['wasmc.public-current-refresh-cohort/v1','wasmc.public-current-composition-cohort/v1'].includes(cohortSchema));
  const noticePolicy=JSON.parse(await read('catalog/current-v3-license-policy.json'));
  declaredNotices=await collectCurrentDeclaredThirdPartyNotices(catalogBytes,noticePolicy,readDeclared);
}


// Source-free standalone releases retain their independently pinned original notices.
for(const [noticePath,pin] of await collectStandaloneReleaseNotices(async relative=>{
 let current=root;for(const segment of relative.split('/')){current=path.join(current,segment);assert.ok(!(await lstat(current)).isSymbolicLink(),'linked standalone notice');}
 assert.ok((await lstat(current)).isFile());return readFile(current);
}))declaredNotices.set(noticePath,pin);
async function walk(directory, relative = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "target") continue;
    assert.ok(!entry.isSymbolicLink(), `linked license-policy input rejected: ${path.join(relative,entry.name)}`);
    const childRelative = path.join(relative, entry.name);
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(child, childRelative));
    else found.push(childRelative);
  }
  return found;
}

for (const relative of await walk(root)) {
  if (!/\.(?:md|json|toml|txt|mjs|js|rs|wit)$/.test(relative) && path.basename(relative) !== "LICENSE") continue;
  const bytes = await readFile(path.join(root,relative));
  if(isExactDeclaredNotice(relative.replaceAll(path.sep,'/'),bytes,declaredNotices))continue;
  const content = bytes.toString('utf8');
  if (!frozenCargoManifests.has(relative) && relative !== "scripts/validate-license-policy.mjs") {
    assert.doesNotMatch(content, /license\s*=\s*["']MIT OR Apache-2\.0["']/i, `${relative} introduces an unexpected old dual-license grant`);
  }
  if (relative !== "scripts/validate-license-policy.mjs") {
    assert.doesNotMatch(content, /^MIT License$/m, `${relative} retains an MIT license declaration`);
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.license-policy/v1",
  policy: "research-only-non-commercial",
  open_source: false,
  commercial_use: false,
  production_use: false,
  noncommercial_cargo_manifests_bound: nonCommercialCargoLicenseFiles.size,
  frozen_cargo_manifests_preserved: frozenCargoManifests.size,
  immutable_prior_tags_preserved: true,
  exact_declared_thirdparty_notice_files: declaredNotices.size,
}));
