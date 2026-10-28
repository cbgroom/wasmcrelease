// Controlled fixture only: generated Roots are not yet licensed, published, or
// admitted. A synthetic catalog exercises the real installer without claiming a release.
import assert from 'node:assert/strict';
import {cp, mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {attachReleaseLicense, inventory, verifyRoot} from '../../../../scripts/lib-refresh-cache-v2.mjs';
import {hash, resolveCurrentPackage} from '../../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib, artifactUrl} from '../../../../scripts/lib-install.mjs';

const [runRoot, receiptPin, out, expectedIdsArg, licenseMode] = process.argv.slice(2);
assert.ok(licenseMode === undefined || licenseMode === "preserve-existing");
assert.ok(isAbsolute(runRoot ?? '') && isAbsolute(out ?? '') && /^[a-f0-9]{64}$/.test(receiptPin ?? ''));
const receiptBytes = await readFile(join(runRoot, 'refresh-receipt.json'));
assert.equal(hash(receiptBytes), receiptPin);
const receipt = JSON.parse(receiptBytes);
assert.equal(receipt.accepted, true);
const expectedIds = expectedIdsArg ? JSON.parse(expectedIdsArg) : ['wasmc-data-core', 'wasmc-data-interchange', 'wasmc-data-relational'];
assert.ok(Array.isArray(expectedIds) && expectedIds.length > 0 && expectedIds.every(x => /^wasmc-[a-z0-9-]+$/.test(x)));
assert.equal(new Set(expectedIds).size, expectedIds.length);
assert.deepEqual([...receipt.selected].sort(), [...expectedIds].sort());
const sourceCatalog = await readFile('catalog/libs-current-v2.json');
assert.equal(hash(sourceCatalog), '6cd97c3e8aa9eb94739c62fb15465243ddb0906831ae7ccd16d6d0289ba1c8fb');
const catalog = JSON.parse(sourceCatalog); catalog.package_authority_commit = '0'.repeat(40);
const license = await readFile('LICENSE');
assert.equal(hash(license), '7bca2d5818178e0bc14546700d39bf113d15139b1c3b6d1e62f621d4a276d6e3');
const noticeBytes = await readFile('.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs/notices/additional-notices.json');
assert.equal(hash(noticeBytes), '28ecd4f6f2d0f50c76bbdd71af4da903712105cd3be147d492967192954d84ad');
const noticePolicy = JSON.parse(noticeBytes);
const notices = [];
for (const item of noticePolicy.files) {
  const content = await readFile(join('current-libs/wasmc-json/0.2.1', item.path));
  assert.equal(content.length, item.bytes); assert.equal(hash(content), item.sha256);
  notices.push({path:item.path,sha256:item.sha256,content});
}
await mkdir(out);
const roots = [];
for (const subject of receipt.rows) {
  assert.equal(subject.state, 'verified');
  const expectedRoot = join(runRoot, 'packages', subject.id);
  assert.equal(subject.package_root, expectedRoot);
  const hasResourceCore = Boolean(subject.resource_core_inputs);
  const verified = await verifyRoot(expectedRoot, subject.id, subject.version, subject.profile, hasResourceCore);
  assert.equal(verified.manifest_sha256, subject.manifest_sha256);
  const sourceFiles = await inventory(expectedRoot);
  assert.equal(hash(Buffer.from(JSON.stringify(sourceFiles))), subject.root_inventory_sha256);
  const licensed = join(out, `licensed-${subject.id}`);
  await cp(expectedRoot, licensed, {recursive:true,force:false,errorOnExist:true});
  if (licenseMode === "preserve-existing") {
    assert.equal(verified.manifest.license?.files?.[0]?.sha256, hash(license));
  } else {
    await attachReleaseLicense(licensed, license, hash(license), notices);
  }
  const licensedVerified = await verifyRoot(licensed, subject.id, subject.version, subject.profile, hasResourceCore);
  const files = await inventory(licensed), manifest = JSON.parse(await readFile(join(licensed, 'lib.json')));
  const row = catalog.packages.find(item => item.id === subject.id);
  assert.ok(row && row.version === subject.version);
  row.manifest_sha256 = licensedVerified.manifest_sha256;
  row.root_inventory_sha256 = hash(Buffer.from(JSON.stringify(files)));
  row.delivery.artifact = manifest.artifact; row.delivery.component = manifest.component;
  row.files = Object.entries(files).map(([name, pin]) => ({path: `${row.root}/${name}`, ...pin}));
  const values = new Map();
  for (const file of row.files) values.set(file.path, await readFile(join(licensed, file.path.slice(row.root.length + 1))));
  roots.push({row, files, values, hasResourceCore});
}
const catalogBytes = Buffer.from(JSON.stringify(catalog)), catalogSha = hash(catalogBytes);
const result = [];
for (const {row, values, hasResourceCore} of roots) {
  const read = path => { assert.ok(values.has(path)); return values.get(path); };
  const lock = resolveCurrentPackage(catalogBytes, catalogSha,
    {id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256}, read);
  const lockBytes = Buffer.from(JSON.stringify(lock) + '\n');
  const urls = new Map(row.files.map(file => [artifactUrl('github', catalog.package_authority_commit, file.path), file.path]));
  let requests = 0;
  const fetcher = async url => { assert.ok(urls.has(url)); requests++; return new Response(read(urls.get(url)), {status:200}); };
  const destination = join(out, `installed-${row.id}`);
  await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes,lockSha256:hash(lockBytes),destination}, fetcher);
  const actual = await realpath(destination);
  for (const file of row.files) {
    const bytes = await readFile(join(actual, file.path));
    assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256);
  }
  assert.equal(requests, row.files.length);
  const root = join(actual, row.root);
  const verify = await verifyRoot(root, row.id, row.version, row.profile, hasResourceCore);
  assert.equal(verify.manifest_sha256, row.manifest_sha256);
  result.push({id:row.id,version:row.version,root,manifest_sha256:row.manifest_sha256,files_verified:requests,
    artifact_sha256:row.delivery.artifact.sha256,component_sha256:row.delivery.component.sha256});
}
const resultReceipt = {accepted:true, transport:'controlled-local-fetch', catalog_commit:'fixture-zero-not-public',
  catalog_sha256:catalogSha, source_receipt_sha256:receiptPin, roots:result,
  license_and_notices_qualified:false, installed_product:false, formal_release:false};
await writeFile(join(out, 'qualification.json'), JSON.stringify(resultReceipt,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify(resultReceipt));
