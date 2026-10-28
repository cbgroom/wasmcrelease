// Controlled transport only: this catalog deliberately uses an all-zero
// fixture identity. It is not publication or anonymous-network evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { attachReleaseLicense, inventory, sha, verifyRoot } from '../../../../scripts/lib-refresh-cache-v2.mjs';
import { hash, resolveCurrentPackage } from '../../../../scripts/current-lib-release-v3.mjs';
import { installCurrentLib, artifactUrl } from '../../../../scripts/lib-install.mjs';

const [sealedArg, outArg] = process.argv.slice(2);
assert(sealedArg && outArg, 'usage: install-json021-edition2024-fixture.mjs SEALED_ROOT FRESH_OUTPUT');
const sealed = path.resolve(sealedArg), out = path.resolve(outArg);
const originalManifest = await fs.readFile(path.join(sealed, 'lib.json'));
assert.equal(sha(originalManifest), '830869308836fa065f422728d64d693fa895273f6577b7175bb5a7473c75eee9');
await fs.mkdir(out);
const root = path.join(out, 'licensed-root');
await fs.cp(sealed, root, {recursive:true, errorOnExist:true, force:false});
const rootPath = 'current-libs/wasmc-json/0.2.1';
const policy = JSON.parse(await fs.readFile('.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs/notices/additional-notices.json'));
const notices = [];
for (const row of policy.files) {
  const content = await fs.readFile(path.join(rootPath, row.path));
  assert.equal(sha(content), row.sha256);
  notices.push({path:row.path, sha256:row.sha256, content});
}
const license = await fs.readFile('LICENSE');
await attachReleaseLicense(root, license, sha(license), notices);
const verified = await verifyRoot(root, 'wasmc-json', '0.2.1', 'value');
const files = await inventory(root);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'lib.json')));
assert.equal(verified.manifest_sha256, files['lib.json'].sha256);
const originalCatalog = await fs.readFile('catalog/libs-current-v2.json');
assert.equal(hash(originalCatalog), '6cd97c3e8aa9eb94739c62fb15465243ddb0906831ae7ccd16d6d0289ba1c8fb');
const catalog = JSON.parse(originalCatalog);
catalog.package_authority_commit = '0'.repeat(40);
const row = catalog.packages.find(v => v.id === 'wasmc-json');
assert.equal(row.version, '0.2.1');
row.manifest_sha256 = files['lib.json'].sha256;
row.root_inventory_sha256 = sha(Buffer.from(JSON.stringify(files)));
row.delivery.artifact = manifest.artifact;
row.delivery.component = manifest.component;
row.files = Object.entries(files).map(([name, pin]) => ({path:`${row.root}/${name}`, ...pin}));
const catalogBytes = Buffer.from(JSON.stringify(catalog));
const catalogSha = hash(catalogBytes);
const read = p => {
  assert(p.startsWith(row.root + '/'));
  return requireBytes.get(p);
};
const requireBytes = new Map();
for (const f of row.files) requireBytes.set(f.path, await fs.readFile(path.join(root, f.path.slice(row.root.length + 1))));
const lock = resolveCurrentPackage(catalogBytes, catalogSha, {id:row.id, version:row.version, manifest_sha256:row.manifest_sha256, root_inventory_sha256:row.root_inventory_sha256}, read);
const lockBytes = Buffer.from(JSON.stringify(lock) + '\n');
const lookup = new Map(row.files.map(f => [artifactUrl('github', catalog.package_authority_commit, f.path), f.path]));
let requests = 0;
const fetcher = async url => { assert(lookup.has(url)); requests++; return new Response(read(lookup.get(url)), {status:200}); };
const destination = path.join(out, 'installed');
const result = await installCurrentLib({catalogBytes, catalogSha256:catalogSha, lockBytes, lockSha256:hash(lockBytes), destination}, fetcher);
assert.equal(requests, row.files.length);
const actual = await fs.realpath(destination);
for (const f of row.files) {
  const bytes = await fs.readFile(path.join(actual, f.path));
  assert.equal(bytes.length, f.bytes); assert.equal(hash(bytes), f.sha256);
}
const receipt = {accepted:true, status:'experimental-not-released', transport:'controlled-local-fetch', catalog_commit:'fixture-zero-not-public', catalog_sha256:catalogSha, manifest_sha256:row.manifest_sha256, files_verified:requests, installed_root:path.join(actual,row.root), installer:result, formal_release:false};
await fs.writeFile(path.join(out, 'qualification.json'), JSON.stringify(receipt,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify(receipt));
