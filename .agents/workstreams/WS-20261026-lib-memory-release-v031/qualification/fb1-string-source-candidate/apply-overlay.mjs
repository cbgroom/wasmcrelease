// Apply the tested successor fixture only to an independently assembled stage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const stage = path.resolve(process.argv[2] ?? '');
assert(process.argv[2], 'explicit assembled stage is required');
const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'overlay.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.schema, 'wasmc.fb1-string-overlay/v1');
assert.equal(sha(fs.readFileSync(path.join(stage, 'current/wasmc_compiler.wasm'))), manifest.compiler_sha256, 'compiler mismatch');
assert.equal(sha(fs.readFileSync(path.join(stage, manifest.root_path))), manifest.root_sha256, 'Text Root mismatch');
const pending = manifest.files.map(row => {
  const destination = path.join(stage, row.path);
  const bytes = fs.readFileSync(path.join(here, 'overlay', row.path));
  assert.equal(sha(fs.readFileSync(destination)), row.before_sha256, `baseline mismatch: ${row.path}`);
  assert.equal(bytes.length, row.bytes, `overlay size mismatch: ${row.path}`);
  assert.equal(sha(bytes), row.after_sha256, `overlay hash mismatch: ${row.path}`);
  return { destination, bytes };
});
for (const { destination, bytes } of pending) fs.writeFileSync(destination, bytes);
console.log(JSON.stringify({ applied: pending.length, compiler_sha256: manifest.compiler_sha256, root_sha256: manifest.root_sha256 }));
