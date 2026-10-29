import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, inventory, sha } from './lib-refresh-cache-v2.mjs';

// Restore published bytes into a new staging directory; this does not turn
// historical Roots into Q0 output or admit the resulting mixture for release.
export async function stageFrozenRoots({ repo, basePath, baseSha, receiptPath, receiptSha, out }) {
  for (const path of [repo, basePath, receiptPath, out]) assert.ok(isAbsolute(path), 'absolute paths required');
  const baseBytes = await readFile(basePath), receiptBytes = await readFile(receiptPath);
  assert.equal(sha(baseBytes), baseSha, 'published catalog pin');
  assert.equal(sha(receiptBytes), receiptSha, 'Q0 receipt pin');
  const base = JSON.parse(baseBytes), receipt = JSON.parse(receiptBytes);
  assert.equal(base.schema, 'wasmc.public-lib-catalog/v2');
  assert.equal(receipt.schema, 'wasmc.lib-refresh-receipt/v2');
  assert.equal(receipt.accepted, true);
  assert.match(base.package_authority_commit, /^[0-9a-f]{40}$/);
  const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
  const commit = git('rev-parse', '--verify', `${base.package_authority_commit}^{commit}`).toString().trim();
  assert.equal(commit, base.package_authority_commit);
  const key = r => {
    assert.match(r.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.match(r.version, /^\d+\.\d+\.\d+$/);
    for (const k of ['manifest_sha256', 'root_inventory_sha256']) assert.match(r[k], /^[0-9a-f]{64}$/);
    return `${r.id}@${r.version}`;
  };
  const prior = new Map(), seen = new Set(), selected = [];
  for (const r of base.packages) { const k = key(r); assert.ok(!prior.has(k)); prior.set(k, r); }
  for (const r of receipt.rows) {
    const k = key(r); assert.ok(!seen.has(k)); seen.add(k);
    const old = prior.get(k);
    if (old && (old.manifest_sha256 !== r.manifest_sha256 || old.root_inventory_sha256 !== r.root_inventory_sha256)) selected.push(old);
  }
  const prepared = [];
  for (const row of selected) {
    assert.equal(row.root, `current-libs/${row.id}/${row.version}`);
    const tree = git('ls-tree', '-r', '-z', commit, '--', row.root + '/').toString().split('\0').filter(Boolean);
    const modes = new Map(tree.map(line => {
      const m = /^(100644|100755) blob [0-9a-f]{40}\t(.+)$/.exec(line);
      assert.ok(m, 'regular Git blobs only'); return [m[2], m[1]];
    }));
    assert.equal(modes.size, row.files.length, `complete tree: ${row.root}`);
    const files = [], inv = {};
    for (const file of row.files) {
      assert.ok(file.path.startsWith(row.root + '/'));
      const rel = file.path.slice(row.root.length + 1);
      assert.ok(rel && rel.split('/').every(p => p && p !== '.' && p !== '..'));
      assert.ok(modes.has(file.path), `missing or duplicate file: ${file.path}`);
      const mode = modes.get(file.path); modes.delete(file.path);
      const bytes = git('show', `${commit}:${file.path}`);
      assert.equal(bytes.length, file.bytes, file.path);
      assert.equal(sha(bytes), file.sha256, file.path);
      inv[rel] = { bytes: file.bytes, sha256: file.sha256 };
      files.push({ path: file.path, mode, bytes });
    }
    assert.equal(modes.size, 0);
    assert.equal(inv['lib.json']?.sha256, row.manifest_sha256);
    assert.equal(digest(inv), row.root_inventory_sha256, row.root);
    prepared.push({ row, files });
  }
  await mkdir(out); // must be absent; all source validation precedes any writes
  for (const { row, files } of prepared) {
    for (const file of files) {
      const path = join(out, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.bytes, { flag: 'wx', mode: file.mode === '100755' ? 0o755 : 0o644 });
    }
    assert.equal(digest(await inventory(join(out, row.root))), row.root_inventory_sha256);
  }
  const result = { schema: 'wasmc.frozen-root-retention/v1', base_catalog_sha256: baseSha,
    package_authority_commit: commit, candidate_receipt_sha256: receiptSha,
    public_admission: false, roots: prepared.map(({ row, files }) => ({ id: row.id, version: row.version,
      manifest_sha256: row.manifest_sha256, root_inventory_sha256: row.root_inventory_sha256, files: files.length })) };
  await writeFile(join(out, 'retention-receipt.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [repo, basePath, baseSha, receiptPath, receiptSha, out] = process.argv.slice(2);
  stageFrozenRoots({ repo, basePath, baseSha, receiptPath, receiptSha, out })
    .then(r => console.log(JSON.stringify(r)))
    .catch(e => { console.error(e); process.exitCode = 1; });
}
