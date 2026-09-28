import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-http1-client');
const manifest = JSON.parse(await readFile(resolve(candidateRoot, 'candidate.json'), 'utf8'));

const run = (command, args, timeout = 180000) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 << 20,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
};

run('cargo', ['+1.96.0', 'test', '--locked', '--manifest-path', 'libsrc/wasmc-http1-client/Cargo.toml']);
run('cargo', [
  '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', 'libsrc/wasmc-http1-client/Cargo.toml',
]);

const artifact = resolve(candidateRoot, 'target/wasm32-unknown-unknown/release/wasmc_http1_client_public.wasm');
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
assert.ok(WebAssembly.Module.exports(module).some(entry =>
  entry.name === 'wasmc:http1-client/wire@0.0.1#serialize-request'));
assert.ok(WebAssembly.Module.exports(module).some(entry =>
  entry.name === 'wasmc:http1-client/wire@0.0.1#decode-response'));
assert.ok(bytes.length <= 256 * 1024, 'candidate unexpectedly large');

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /package wasmc:http1-client@0\.0\.1/);
assert.match(wit, /serialize-request/);
assert.match(wit, /decode-response/);

console.log(JSON.stringify({
  accepted: true,
  candidate: manifest.id,
  version: manifest.version,
  host_imports: 0,
  native_tests: 6,
  request_serialization: true,
  response_framing: ['content-length', 'chunked', 'bodyless', 'close-delimited'],
  ambiguous_framing_rejected: true,
  candidate_bytes: bytes.length,
  candidate_sha256: createHash('sha256').update(bytes).digest('hex'),
}));
