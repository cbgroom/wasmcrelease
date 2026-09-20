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

const httpErrors = [
  'input-too-large',
  'too-many-headers',
  'invalid-syntax',
  'incomplete',
  'invalid-version',
  'invalid-status',
  'invalid-header-name',
  'invalid-header-value',
  'output-too-large',
  'invalid-content-length',
  'unsupported-framing',
  'body-too-large',
];

const allocBytes = (instance, bytes) => {
  if (bytes.length === 0) return 0;
  const ptr = instance.exports.cabi_realloc(0, 0, 1, bytes.length);
  new Uint8Array(instance.exports.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
};

const serializeCore = (module, minor, status, headers) => {
  const instance = new WebAssembly.Instance(module, {});
  const encoded = headers.map(([name, value]) => {
    const nameBytes = new TextEncoder().encode(name);
    const valueBytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    return {
      nameBytes,
      valueBytes,
      namePtr: allocBytes(instance, nameBytes),
      valuePtr: allocBytes(instance, valueBytes),
    };
  });
  const headersPtr = encoded.length === 0
    ? 0
    : instance.exports.cabi_realloc(0, 0, 4, encoded.length * 16);
  if (encoded.length !== 0) {
    const view = new DataView(instance.exports.memory.buffer);
    for (let index = 0; index < encoded.length; index++) {
      const row = encoded[index];
      const offset = headersPtr + index * 16;
      view.setUint32(offset, row.namePtr, true);
      view.setUint32(offset + 4, row.nameBytes.length, true);
      view.setUint32(offset + 8, row.valuePtr, true);
      view.setUint32(offset + 12, row.valueBytes.length, true);
    }
  }
  const resultPtr = instance.exports['wasmc:http1-server/wire@0.0.1#serialize-response-head'](
    minor,
    status,
    headersPtr,
    encoded.length,
  );
  const view = new DataView(instance.exports.memory.buffer);
  const tag = view.getUint8(resultPtr);
  let result;
  if (tag === 1) {
    result = { error: httpErrors[view.getUint8(resultPtr + 4)] };
  } else {
    assert.equal(tag, 0);
    const outputPtr = view.getUint32(resultPtr + 4, true);
    const outputLength = view.getUint32(resultPtr + 8, true);
    const output = new Uint8Array(instance.exports.memory.buffer, outputPtr, outputLength).slice();
    result = {
      output_length: outputLength,
      output_hex: Buffer.from(output).toString('hex'),
    };
  }
  const post = instance.exports['cabi_post_wasmc:http1-server/wire@0.0.1#serialize-response-head'];
  if (typeof post === 'function') post(resultPtr);
  return result;
};

const frameLengthCore = (module, bytes) => {
  const instance = new WebAssembly.Instance(module, {});
  const ptr = allocBytes(instance, bytes);
  const resultPtr = instance.exports['wasmc:http1-server/wire@0.0.1#request-frame-length'](
    ptr,
    bytes.length,
  );
  const view = new DataView(instance.exports.memory.buffer);
  const tag = view.getUint8(resultPtr);
  if (tag === 1) return { error: httpErrors[view.getUint8(resultPtr + 4)] };
  assert.equal(tag, 0);
  const optionTag = view.getUint8(resultPtr + 4);
  if (optionTag === 0) return { frame_length: null };
  assert.equal(optionTag, 1);
  return { frame_length: view.getUint32(resultPtr + 8, true) };
};

const parseCore = (module, bytes) => {
  const instance = new WebAssembly.Instance(module, {});
  const ptr = allocBytes(instance, bytes);
  const resultPtr = instance.exports['wasmc:http1-server/wire@0.0.1#parse-request'](
    ptr,
    bytes.length,
  );
  const view = new DataView(instance.exports.memory.buffer);
  const tag = view.getUint8(resultPtr);
  const result = tag === 1
    ? { error: httpErrors[view.getUint8(resultPtr + 4)] }
    : { ok: true };
  const post = instance.exports['cabi_post_wasmc:http1-server/wire@0.0.1#parse-request'];
  if (typeof post === 'function') post(resultPtr);
  return result;
};

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

  const boundaryReceipts = [];
  const makeRequest = count => {
    let request = 'GET / HTTP/1.1\r\n';
    for (let index = 0; index < count; index++) request += 'X-' + index + ': a\r\n';
    request += '\r\n';
    return Buffer.from(request);
  };
  for (const count of [32, 33]) {
    const bytes = makeRequest(count);
    const oracle = parseCore(oracleModule, bytes);
    const candidate = parseCore(candidateModule, bytes);
    assert.deepEqual(candidate, oracle, 'request headers ' + count);
    boundaryReceipts.push({ name: 'request-headers-' + count, result: candidate });

    const headers = Array.from({ length: count }, (_, index) => [
      'x-' + index,
      Uint8Array.of(97),
    ]);
    const oracleSerialized = serializeCore(oracleModule, 1, 200, headers);
    const candidateSerialized = serializeCore(candidateModule, 1, 200, headers);
    assert.deepEqual(candidateSerialized, oracleSerialized, 'response headers ' + count);
    boundaryReceipts.push({
      name: 'response-headers-' + count,
      result: candidateSerialized.error ?? { output_length: candidateSerialized.output_length },
    });
  }

  for (const bodyLength of [1 << 20, (1 << 20) + 1]) {
    const bytes = Buffer.from(
      'GET / HTTP/1.1\r\nContent-Length: ' + bodyLength + '\r\n\r\n',
    );
    const oracle = frameLengthCore(oracleModule, bytes);
    const candidate = frameLengthCore(candidateModule, bytes);
    assert.deepEqual(candidate, oracle, 'body length ' + bodyLength);
    boundaryReceipts.push({ name: 'body-' + bodyLength, result: candidate });
  }

  for (const inputLength of [64 << 10, (64 << 10) + 1]) {
    const prefix = 'GET / HTTP/1.1\r\nX: ';
    const bytes = Buffer.from(prefix + 'a'.repeat(inputLength - prefix.length));
    const oracle = frameLengthCore(oracleModule, bytes);
    const candidate = frameLengthCore(candidateModule, bytes);
    assert.deepEqual(candidate, oracle, 'input length ' + inputLength);
    boundaryReceipts.push({ name: 'input-' + inputLength, result: candidate });
  }

  for (const valueLength of [65512, 65520]) {
    const headers = [['x', new Uint8Array(valueLength).fill(97)]];
    const oracle = serializeCore(oracleModule, 1, 200, headers);
    const candidate = serializeCore(candidateModule, 1, 200, headers);
    assert.deepEqual(candidate, oracle, 'output value length ' + valueLength);
    boundaryReceipts.push({
      name: 'output-value-' + valueLength,
      result: candidate.error ?? { output_length: candidate.output_length },
    });
  }

  let statusCases = 0;
  for (let status = 0; status <= 1000; status++) {
    const oracle = serializeCore(oracleModule, 1, status, []);
    const candidate = serializeCore(candidateModule, 1, status, []);
    assert.deepEqual(candidate, oracle, 'status ' + status);
    statusCases++;
  }

  let headerNameCases = 0;
  for (let code = 0; code < 128; code++) {
    const name = String.fromCharCode(code);
    const oracle = serializeCore(oracleModule, 1, 200, [[name, Uint8Array.of(97)]]);
    const candidate = serializeCore(candidateModule, 1, 200, [[name, Uint8Array.of(97)]]);
    assert.deepEqual(candidate, oracle, 'header name code ' + code);
    headerNameCases++;
  }
  for (const name of ['', 'abc', 'a-b', 'a_b', 'a.b', 'a:b', 'a b', 'é']) {
    const oracle = serializeCore(oracleModule, 1, 200, [[name, Uint8Array.of(97)]]);
    const candidate = serializeCore(candidateModule, 1, 200, [[name, Uint8Array.of(97)]]);
    assert.deepEqual(candidate, oracle, 'header name ' + JSON.stringify(name));
    headerNameCases++;
  }

  let headerValueCases = 0;
  for (let code = 0; code < 256; code++) {
    const oracle = serializeCore(oracleModule, 1, 200, [['x', Uint8Array.of(code)]]);
    const candidate = serializeCore(candidateModule, 1, 200, [['x', Uint8Array.of(code)]]);
    assert.deepEqual(candidate, oracle, 'header value byte ' + code);
    headerValueCases++;
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    cases: cases.length + boundaryReceipts.length + statusCases + headerNameCases + headerValueCases,
    host_imports: 0,
    wit_equivalent: true,
    http1_framing_equivalent: true,
    oracle_sha256: manifest.oracle.sha256,
    candidate_sha256: createHash('sha256').update(candidateBytes).digest('hex'),
    candidate_bytes: candidateBytes.length,
    representative_behavior_equivalent: true,
    resource_boundary_calibration: {
      input_bytes: 64 << 10,
      body_bytes: 1 << 20,
      headers: 32,
      output_bytes: 64 << 10,
      equivalent: true,
    },
    broader_status_header_coverage: {
      status_codes: statusCases,
      header_name_cases: headerNameCases,
      header_value_cases: headerValueCases,
      equivalent: true,
    },
    receipts,
    boundary_receipts: boundaryReceipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
