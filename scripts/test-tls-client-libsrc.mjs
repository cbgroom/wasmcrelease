import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-tls-client');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: options.timeout ?? 900000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
};

const providedCandidate = process.env.WASMC_TLS_CLIENT_ARTIFACT?.trim();
if (!providedCandidate) {
  run('cargo', [
    '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', 'libsrc/wasmc-tls-client/Cargo.toml',
  ]);
}
run('cargo', [
  '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', 'libsrc/wasmc-http1-client/Cargo.toml',
]);

const candidatePath = providedCandidate
  ? resolve(root, providedCandidate)
  : resolve(candidateRoot, 'target/wasm32-unknown-unknown/release/wasmc_tls_client_public.wasm');
const bytes = await readFile(candidatePath);
const candidateSha256 = createHash('sha256').update(bytes).digest('hex');
const artifactObservationMatches =
  bytes.length === manifest.artifact_observation.bytes &&
  candidateSha256 === manifest.artifact_observation.sha256;
if (process.env.WASMC_TLS_CLIENT_ENFORCE_OBSERVATION === '1') {
  assert.equal(bytes.length, manifest.artifact_observation.bytes);
  assert.equal(candidateSha256, manifest.artifact_observation.sha256);
}
const wit = run('wasm-tools', ['component', 'wit', candidatePath]);
assert.match(wit, /import wasmc:tls-core\/entropy@0\.0\.1/);
assert.match(wit, /export wasmc:tls-client\/tls@0\.0\.1/);
assert.doesNotMatch(wit, /import .*clock/i);
assert.doesNotMatch(wit, /import .*network/i);
assert.doesNotMatch(wit, /import .*socket/i);
const rootWorld = wit.match(/world root \{([\s\S]*?)\n\}/)?.[1];
assert.ok(rootWorld);
assert.equal([...rootWorld.matchAll(/^\s*import\s+/gm)].length, 1);

const raw = run('wasm-tools', ['print', candidatePath]);
assert.match(raw, /\(import "wasmc:tls-core\/entropy@0\.0\.1" "fill"/);

const httpPath = resolve(
  root,
  'libsrc/wasmc-http1-client/target/wasm32-unknown-unknown/release/wasmc_http1_client_public.wasm',
);
const http = new WebAssembly.Instance(new WebAssembly.Module(await readFile(httpPath)), {});
const alloc = value => {
  if (value.length === 0) return 0;
  const ptr = http.exports.cabi_realloc(0, 0, 1, value.length);
  new Uint8Array(http.exports.memory.buffer, ptr, value.length).set(value);
  return ptr;
};
const encoder = new TextEncoder();
const method = encoder.encode('GET');
const target = encoder.encode('/health');
const name = encoder.encode('host');
const value = encoder.encode('example.com');
const methodPtr = alloc(method);
const targetPtr = alloc(target);
const namePtr = alloc(name);
const valuePtr = alloc(value);
const headersPtr = http.exports.cabi_realloc(0, 0, 4, 16);
const headerView = new DataView(http.exports.memory.buffer);
for (const [offset, number] of [[0, namePtr], [4, name.length], [8, valuePtr], [12, value.length]]) {
  headerView.setUint32(headersPtr + offset, number, true);
}
const resultPtr = http.exports['wasmc:http1-client/wire@0.0.1#serialize-request'](
  methodPtr, method.length, targetPtr, target.length, headersPtr, 1, 0, 0,
);
const resultView = new DataView(http.exports.memory.buffer);
assert.equal(resultView.getUint8(resultPtr), 0);
const requestPtr = resultView.getUint32(resultPtr + 4, true);
const requestLength = resultView.getUint32(resultPtr + 8, true);
const request = new Uint8Array(http.exports.memory.buffer, requestPtr, requestLength).slice();
assert.equal(new TextDecoder().decode(request), 'GET /health HTTP/1.1\r\nhost: example.com\r\n\r\n');

const work = await mkdtemp(join(tmpdir(), 'wasmc-tls-client-'));
try {
  const componentPath = join(work, 'tls-client.component.wasm');
  const httpComponentPath = join(work, 'http-client.component.wasm');
  const requestPath = join(work, 'request.bin');
  const responsePath = join(work, 'response.bin');
  await writeFile(requestPath, request);
  run('wasm-tools', ['component', 'new', candidatePath, '-o', componentPath]);
  run('wasm-tools', ['component', 'new', httpPath, '-o', httpComponentPath]);
  run('cargo', [
    '+1.96.0', 'build', '--release', '--locked',
    '--manifest-path', 'libsrc/wasmc-tls-client/tests/host/Cargo.toml',
  ]);
  const binary = resolve(
    root,
    'libsrc/wasmc-tls-client/tests/host/target/release/wasmc-tls-client-host-test',
  ) + (process.platform === 'win32' ? '.exe' : '');
  const output = run(binary, [], {
    timeout: 30000,
    env: {
      WASMC_TLS_CLIENT_COMPONENT: componentPath,
      WASMC_TLS_CERT: resolve(root, 'host/tests/https/fixtures/server-cert.der'),
      WASMC_TLS_KEY: resolve(root, 'host/tests/https/fixtures/server-key.pkcs8.der'),
      WASMC_TLS_HTTP_REQUEST: requestPath,
      WASMC_TLS_HTTP_RESPONSE_OUTPUT: responsePath,
    },
  });
  const receipt = JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(receipt.accepted, true);
  assert.ok(receipt.handshake_rounds >= 1 && receipt.handshake_rounds <= 64);
  assert.ok(receipt.client_ciphertext > 0);
  assert.ok(receipt.server_ciphertext > 0);
  assert.ok(receipt.entropy_calls > 0);
  assert.equal(receipt.http_request_bytes, request.length);
  assert.ok(receipt.http_response_bytes > 0);
  assert.equal(receipt.alpn, 'http/1.1');
  assert.equal(receipt.hostname_rejected, true);
  assert.deepEqual(receipt.root_boundary, { accepted: 256, rejected: 257 });
  assert.ok(receipt.close_notify_bytes > 0);
  assert.equal(receipt.loopback_https, true);
  assert.ok(receipt.loopback_tls_bytes > 0);
  assert.deepEqual(receipt.host_imports, ['wasmc:tls-core/entropy@0.0.1#fill']);
  const response = await readFile(responsePath);
  const decoded = run('wasmtime', [
    'run', '--invoke',
    `decode-response([${[...response].join(',')}], "GET", true)`,
    httpComponentPath,
  ], { timeout: 30000 });
  assert.match(decoded, /status: 200/);
  assert.match(decoded, /body: \[111, 107\]/);

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: bytes.length,
    candidate_sha256: candidateSha256,
    artifact_source: providedCandidate ? 'provided-canonical-artifact' : 'local-source-build',
    artifact_observation_matches: artifactObservationMatches,
    semantic_host_imports: manifest.allowed_host_imports,
    host_clock_import: false,
    host_network_import: false,
    host_socket_import: false,
    http1_client_composed: true,
    http1_response_decoded: true,
    handshake: receipt,
    admitted: false,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
