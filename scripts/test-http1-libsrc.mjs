import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-http1');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));
const oraclePath = resolve(root, manifest.oracle.path);
const oracleBytes = await readFile(oraclePath);
assert.equal(
  createHash('sha256').update(oracleBytes).digest('hex'),
  manifest.oracle.sha256,
  'oracle digest drift',
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 180000,
    maxBuffer: 32 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
};

run('cargo', [
  '+1.96.0',
  'build',
  '--release',
  '--locked',
  '--target',
  'wasm32-unknown-unknown',
  '--manifest-path',
  'libsrc/wasmc-http1/Cargo.toml',
]);

const candidatePath = resolve(
  root,
  'libsrc/wasmc-http1/target/wasm32-unknown-unknown/release/wasmc_http1_public.wasm',
);
const candidateBytes = await readFile(candidatePath);
assert.ok(candidateBytes.length <= 256 * 1024, 'candidate unexpectedly large');

const candidateModule = new WebAssembly.Module(candidateBytes);
const oracleModule = new WebAssembly.Module(oracleBytes);
assert.deepEqual(WebAssembly.Module.imports(candidateModule), []);
assert.deepEqual(WebAssembly.Module.imports(oracleModule), []);

const oracleWit = run('wasm-tools', ['component', 'wit', oraclePath]);
const candidateWit = run('wasm-tools', ['component', 'wit', candidatePath]);
assert.equal(candidateWit, oracleWit, 'candidate WIT differs from frozen oracle contract');

const toBytes = value => '[' + [...new TextEncoder().encode(value)].join(',') + ']';
const requests = [
  'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n',
  'POST /items HTTP/1.1\r\nHost: x\r\nContent-Length: 5\r\n\r\nhello',
  'POST /items HTTP/1.1\r\nHost: x\r\nContent-Length: 5\r\n\r\nhel',
  'POST /items HTTP/1.1\r\nContent-Length: x\r\n\r\n',
  'POST /items HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n',
  'GET / HTTP/1.0\r\n\r\n',
  'BAD\r\n\r\n',
];
const cases = [];
for (const request of requests) {
  cases.push('parse-request(' + toBytes(request) + ')');
  cases.push('request-frame-length(' + toBytes(request) + ')');
}
cases.push('serialize-response-head(1, 200, [])');
cases.push(
  'serialize-response-head(1, 201, [{name:"content-type",value:' +
    toBytes('application/json') +
    '}])',
);
cases.push('serialize-response-head(0, 204, [])');
cases.push('serialize-response-head(2, 200, [])');
cases.push('serialize-response-head(1, 99, [])');

const work = await mkdtemp(join(tmpdir(), 'wasmc-http1-graduation-'));
try {
  const oracleComponent = join(work, 'oracle.component.wasm');
  const candidateComponent = join(work, 'candidate.component.wasm');
  run('wasm-tools', ['component', 'new', oraclePath, '-o', oracleComponent]);
  run('wasm-tools', ['component', 'new', candidatePath, '-o', candidateComponent]);

  const receipts = [];
  for (const invocation of cases) {
    const oracle = run('wasmtime', ['run', '--invoke', invocation, oracleComponent], { timeout: 30000 });
    const candidate = run('wasmtime', ['run', '--invoke', invocation, candidateComponent], { timeout: 30000 });
    assert.equal(candidate, oracle, invocation);
    receipts.push({ invocation, result: candidate });
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    cases: cases.length,
    host_imports: 0,
    wit_equivalent: true,
    http1_framing_equivalent: true,
    oracle_sha256: manifest.oracle.sha256,
    candidate_sha256: createHash('sha256').update(candidateBytes).digest('hex'),
    candidate_bytes: candidateBytes.length,
    representative_behavior_equivalent: true,
    resource_boundary_calibration: 'pending',
    broader_status_header_coverage: 'pending',
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
