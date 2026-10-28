import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash, currentProductReader, resolveCurrentPackage} from '../../../scripts/current-lib-release-v3.mjs';
import {artifactUrl, installCurrentLib} from '../../../scripts/lib-install.mjs';

// Synthetic catalog and controlled local transport: this exercises the actual
// installer, but is not a public release or a qualified package Root.
const read = currentProductReader(process.cwd());
const catalog = JSON.parse(read('catalog/libs-current-v2.json'));
catalog.package_authority_commit = '0'.repeat(40);
const row = catalog.packages.find(r => r.id === 'wasmc-json');
assert.ok(row);
const extra = new Map();
for (let i = 0; i < 1700; i++) {
  const path = `${row.root}/fixture/file-${String(i).padStart(5, '0')}-${'x'.repeat(70)}.dat`;
  const data = Buffer.from(`payload-${i}`);
  extra.set(path, data);
  row.files.push({path, bytes: data.length, sha256: hash(data)});
}
row.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
row.root_inventory_sha256 = hash(JSON.stringify(Object.fromEntries(row.files.map(f =>
  [f.path.slice(row.root.length + 1), {bytes:f.bytes, sha256:f.sha256}]))));
const catalogBytes = Buffer.from(JSON.stringify(catalog));
const catalogSha256 = hash(catalogBytes);
const fixtureRead = p => extra.get(p) ?? read(p);
const lock = resolveCurrentPackage(catalogBytes, catalogSha256, {
  id:row.id, version:row.version, manifest_sha256:row.manifest_sha256,
  root_inventory_sha256:row.root_inventory_sha256,
}, fixtureRead);
const lockBytes = Buffer.from(JSON.stringify(lock));
assert.ok(lockBytes.length > 262144);
const urls = new Map(row.files.map(f => [artifactUrl('github', catalog.package_authority_commit, f.path), f.path]));
let requests = 0;
const fetcher = async url => {
  requests++;
  assert.ok(urls.has(url));
  return new Response(fixtureRead(urls.get(url)), {status:200});
};
const temporary = await mkdtemp(join(tmpdir(), 'wasmc-large-lock-'));
try {
  const destination = join(temporary, 'installed');
  const args = {catalogBytes, catalogSha256, lockBytes, lockSha256:hash(lockBytes), destination};
  await assert.rejects(installCurrentLib({...args, lockSha256:'f'.repeat(64)}, fetcher),
    e => e.code === 'install.lock_identity_mismatch');
  assert.equal(requests, 0);
  await assert.rejects(installCurrentLib(args, async () =>
    new Response(Buffer.alloc(row.files[0].bytes))), e => e.code === 'install.digest_mismatch');
  assert.deepEqual(await readdir(temporary), []);
  const receipt = await installCurrentLib(args, fetcher);
  assert.equal(receipt.files_verified, row.files.length);
  assert.equal(requests, row.files.length);
  const installed = currentProductReader(await realpath(destination));
  for (const file of row.files) assert.equal(hash(installed(file.path)), file.sha256);
  const saved = JSON.parse(await readFile(join(destination, 'install-receipt.json')));
  assert.deepEqual(saved, receipt);
  console.log(JSON.stringify({lock_bytes:lockBytes.length, files:row.files.length,
    actual_installer:true, all_files_read_back:true, lock_digest_rejection:true,
    file_digest_rejection_and_cleanup:true,
    controlled_transport:true, synthetic_catalog:true, formal_release:false}));
} finally {
  await rm(temporary, {recursive:true, force:true});
}
