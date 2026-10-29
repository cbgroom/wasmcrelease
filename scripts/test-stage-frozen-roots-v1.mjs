import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { digest, sha } from './lib-refresh-cache-v2.mjs';
import { stageFrozenRoots } from './stage-frozen-roots-v1.mjs';

test('retain exact frozen blobs and reject incorrect pins and incomplete catalogs', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'frozen-roots-'));
  try {
    const repo = join(temp, 'repo'), root = 'current-libs/test-lib/1.0.0';
    await mkdir(join(repo, root), { recursive: true });
    const bytes = Buffer.from('{"id":"test-lib"}\n');
    await writeFile(join(repo, root, 'lib.json'), bytes);
    const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture');
    const commit = git('rev-parse', 'HEAD');
    const file = { path: `${root}/lib.json`, bytes: bytes.length, sha256: sha(bytes) };
    const row = { id: 'test-lib', version: '1.0.0', root, files: [file], manifest_sha256: sha(bytes),
      root_inventory_sha256: digest({ 'lib.json': { bytes: bytes.length, sha256: sha(bytes) } }) };
    const base = { schema: 'wasmc.public-lib-catalog/v2', package_authority_commit: commit, packages: [row] };
    const receipt = { schema: 'wasmc.lib-refresh-receipt/v2', accepted: true,
      rows: [{ ...row, manifest_sha256: 'a'.repeat(64) }] };
    const basePath = join(temp, 'base.json'), receiptPath = join(temp, 'q0.json');
    const encode = x => Buffer.from(JSON.stringify(x));
    await writeFile(basePath, encode(base)); await writeFile(receiptPath, encode(receipt));
    const args = { repo, basePath, baseSha: sha(encode(base)), receiptPath, receiptSha: sha(encode(receipt)), out: join(temp, 'out') };
    await assert.rejects(stageFrozenRoots({ ...args, baseSha: '0'.repeat(64) }), /catalog pin/);
    await assert.rejects(stageFrozenRoots({ ...args, receiptSha: '0'.repeat(64) }), /receipt pin/);
    const result = await stageFrozenRoots(args);
    assert.equal(result.roots.length, 1);
    assert.deepEqual(await readFile(join(args.out, root, 'lib.json')), bytes);
    await assert.rejects(stageFrozenRoots(args), /EEXIST/);
    base.packages[0].files = [];
    await writeFile(basePath, encode(base));
    await assert.rejects(stageFrozenRoots({ ...args, baseSha: sha(encode(base)), out: join(temp, 'incomplete') }), /complete tree/);
    await assert.rejects(readFile(join(temp, 'incomplete', 'retention-receipt.json')), /ENOENT/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
