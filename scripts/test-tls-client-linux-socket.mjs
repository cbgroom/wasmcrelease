import { generatedLib } from './generated-lib-v2.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux', 'Linux socket TLS composition requires Linux');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'target/tls-client-linux-socket');
const selectedSocket = await generatedLib('wasmc-system-linux-socket');
const socketRoot = selectedSocket.root;
const adapter = path.join(target, 'libwasmc_system_linux_socket.so');
const descriptor = path.join(target, 'native-boundary.json');
const executorTarget = path.join(target, 'executor');
const executor = path.join(executorTarget, 'release/wasmc-lib-boundary-native-linux');
const executorManifest = path.join(root, 'host/runtime/lib-boundary/native-linux/Cargo.toml');
const candidate = (await generatedLib('wasmc-tls-client')).artifact;
const certDer = path.join(root, 'host/tests/https/fixtures/server-cert.der');
const keyDer = path.join(root, 'host/tests/https/fixtures/server-key.pkcs8.der');
const certPem = path.join(target, 'server-cert.pem');
const keyPem = path.join(target, 'server-key.pem');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (program, args, options = {}) => execFileSync(program, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options,
});

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(selectedSocket.artifact, adapter);
const toolchain = process.env.WASMC_RUST_TOOLCHAIN ?? '+1.96.0';
const cargoArgs = args => toolchain ? [toolchain, ...args] : args;
command('cargo', cargoArgs([
  'build', '--release', '--locked', '--manifest-path', executorManifest,
]), { env: { ...process.env, CARGO_TARGET_DIR: executorTarget } });
const adapterSha256 = sha256(fs.readFileSync(adapter));
const descriptorTemplate = fs.readFileSync(
  path.join(socketRoot, 'platform/native-boundary.template.json'),
  'utf8',
);
fs.writeFileSync(descriptor, descriptorTemplate.replace('BUILD_OUTPUT_SHA256', adapterSha256));
fs.writeFileSync(certPem, command('openssl', ['x509', '-inform', 'DER', '-in', certDer]));
fs.writeFileSync(keyPem, command('openssl', ['pkey', '-inform', 'DER', '-in', keyDer]));

const encodeIpv4 = (octets, port) => {
  const bytes = Buffer.alloc(6);
  octets.forEach((octet, index) => bytes.writeUInt8(octet, index));
  bytes.writeUInt16LE(port, 4);
  return bytes;
};
const encodeConnect = (octets, port) => Buffer.concat([Buffer.from([2]), encodeIpv4(octets, port)]);
const encodeRead = (token, maximum) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(6, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(maximum, 9);
  return bytes;
};
const encodeWrite = (token, payload) => {
  const bytes = Buffer.alloc(13 + payload.length);
  bytes.writeUInt8(7, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(payload.length, 9);
  payload.copy(bytes, 13);
  return bytes;
};
const encodeToken = (operation, token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(operation, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};

class NativeSession {
  constructor() {
    this.child = spawn(executor, ['--session', descriptor], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    this.stderr = '';
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => { this.stderr += chunk; });
    this.child.stdout.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 8) {
        const length = this.buffer.readUInt32LE(4);
        if (this.buffer.length < 8 + length) break;
        const response = {
          status: this.buffer.readInt32LE(0),
          output: this.buffer.subarray(8, 8 + length),
        };
        this.buffer = this.buffer.subarray(8 + length);
        const pending = this.pending.shift();
        assert.ok(pending, 'native executor produced an unsolicited response');
        pending.resolve(response);
      }
    });
  }

  request(payload) {
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32LE(payload.length, 0);
    payload.copy(frame, 4);
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.child.stdin.write(frame, error => { if (error) reject(error); });
    });
  }

  async invoke(payload) {
    const response = await this.request(payload);
    assert.equal(response.status, 0, `socket adapter status ${response.status}`);
    return response.output;
  }

  async close() {
    this.child.stdin.end();
    const code = await new Promise(resolve => this.child.once('close', resolve));
    assert.equal(code, 0, this.stderr);
    assert.equal(this.pending.length, 0);
    assert.equal(this.buffer.length, 0);
  }
}

let instance;
let random = 0x9e3779b9d1cebeefn;
let entropyCalls = 0;
const imports = {
  'wasmc:tls-core/entropy@0.0.1': {
    fill(length, resultPointer) {
      entropyCalls += 1;
      const pointer = instance.exports.cabi_realloc(0, 0, 1, length);
      const output = new Uint8Array(instance.exports.memory.buffer, pointer, length);
      for (let index = 0; index < length; index += 1) {
        random ^= random << 13n;
        random ^= random >> 7n;
        random ^= random << 17n;
        random &= 0xffffffffffffffffn;
        output[index] = Number((random >> 24n) & 0xffn);
      }
      const result = new DataView(instance.exports.memory.buffer);
      result.setUint8(resultPointer, 0);
      result.setUint32(resultPointer + 4, pointer, true);
      result.setUint32(resultPointer + 8, length, true);
    },
  },
  '[export]wasmc:tls-client/tls@0.0.1': {
    '[resource-new]session': representation => representation,
    '[resource-drop]session': () => {},
  },
};
instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(candidate)), imports);
const memory = instance.exports.memory;
const view = () => new DataView(memory.buffer);
const allocate = (bytes, alignment = 1) => {
  const pointer = instance.exports.cabi_realloc(0, 0, alignment, bytes.length);
  new Uint8Array(memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
};
const readResultBytes = (resultPointer, post) => {
  assert.equal(view().getUint8(resultPointer), 0);
  const pointer = view().getUint32(resultPointer + 4, true);
  const length = view().getUint32(resultPointer + 8, true);
  const output = Buffer.from(new Uint8Array(memory.buffer, pointer, length));
  if (post) post(resultPointer);
  return output;
};
const callResultUnit = resultPointer => assert.equal(view().getUint8(resultPointer), 0);
const callResultU32 = resultPointer => {
  assert.equal(view().getUint8(resultPointer), 0);
  return view().getUint32(resultPointer + 4, true);
};

const serverName = Buffer.from('example.com');
const serverNamePointer = allocate(serverName);
const certificate = fs.readFileSync(certDer);
const certificatePointer = allocate(certificate);
const roots = Buffer.alloc(8);
roots.writeUInt32LE(certificatePointer, 0);
roots.writeUInt32LE(certificate.length, 4);
const rootsPointer = allocate(roots, 4);
const alpn = Buffer.from('http/1.1');
const alpnPointer = allocate(alpn);
const alpns = Buffer.alloc(8);
alpns.writeUInt32LE(alpnPointer, 0);
alpns.writeUInt32LE(alpn.length, 4);
const alpnsPointer = allocate(alpns, 4);
const create = instance.exports['wasmc:tls-client/tls@0.0.1#create'];
const createResult = create(
  serverNamePointer, serverName.length, rootsPointer, 1, 1700000000n, alpnsPointer, 1,
);
assert.equal(view().getUint8(createResult), 0);
const tlsSession = view().getUint32(createResult + 4, true);
const state = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.state'];
const output = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.output'];
const postOutput = instance.exports['cabi_post_wasmc:tls-client/tls@0.0.1#[method]session.output'];
const commit = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.commit-output'];
const ingest = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.ingest'];
const writeTls = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.write'];
const readTls = instance.exports['wasmc:tls-client/tls@0.0.1#[method]session.read'];
const postRead = instance.exports['cabi_post_wasmc:tls-client/tls@0.0.1#[method]session.read'];
const destroy = instance.exports['wasmc:tls-client/tls@0.0.1#[dtor]session'];

const response = Buffer.from('HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok');
const request = Buffer.from('GET /health HTTP/1.1\r\nhost: example.com\r\n\r\n');
const server = tls.createServer({
  key: fs.readFileSync(keyPem),
  cert: fs.readFileSync(certPem),
  ALPNProtocols: ['http/1.1'],
}, socket => {
  const chunks = [];
  socket.on('data', chunk => {
    chunks.push(chunk);
    if (Buffer.concat(chunks).includes('\r\n\r\n')) socket.end(response);
  });
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
const transport = new NativeSession();
const stream = (await transport.invoke(encodeConnect([127, 0, 0, 1], port))).readBigUInt64LE();
let adapterWrites = 0;
let adapterReads = 0;

const flush = async () => {
  let total = 0;
  for (;;) {
    const encrypted = readResultBytes(output(tlsSession, 64 * 1024), postOutput);
    if (encrypted.length === 0) break;
    const written = (await transport.invoke(encodeWrite(stream, encrypted))).readBigUInt64LE();
    assert.equal(Number(written), encrypted.length);
    callResultUnit(commit(tlsSession, encrypted.length));
    adapterWrites += 1;
    total += encrypted.length;
  }
  return total;
};
const receive = async () => {
  const encrypted = await transport.invoke(encodeRead(stream, 64 * 1024));
  assert.ok(encrypted.length > 0, 'TLS peer closed unexpectedly');
  const pointer = allocate(encrypted);
  assert.equal(callResultU32(ingest(tlsSession, pointer, encrypted.length)), encrypted.length);
  adapterReads += 1;
  return encrypted.length;
};

let handshakeRounds = 0;
for (; handshakeRounds < 64; handshakeRounds += 1) {
  await flush();
  const progressPointer = state(tlsSession);
  const stateTag = view().getUint8(progressPointer);
  const pendingOutput = view().getUint32(progressPointer + 4, true);
  if (stateTag === 1 && pendingOutput === 0) break;
  await receive();
}
assert.ok(handshakeRounds < 64, 'TLS client handshake did not complete');
const requestPointer = allocate(request);
assert.equal(callResultU32(writeTls(tlsSession, requestPointer, request.length)), request.length);
await flush();
let plaintext = Buffer.alloc(0);
for (let round = 0; round < 64 && plaintext.length < response.length; round += 1) {
  await receive();
  const chunk = readResultBytes(readTls(tlsSession, response.length), postRead);
  plaintext = Buffer.concat([plaintext, chunk]);
}
assert.deepEqual(plaintext, response);
destroy(tlsSession);
await transport.invoke(encodeToken(10, stream));
await transport.close();
await new Promise(resolve => server.close(resolve));

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.tls-client-linux-socket-composition/v1',
  platform: process.platform,
  architecture: process.arch,
  tls_candidate_sha256: sha256(fs.readFileSync(candidate)),
  socket_identity: 'wasmc:system-linux-socket@0.0.1-dev.1',
  socket_adapter_sha256: adapterSha256,
  fixed_executor_sha256: sha256(fs.readFileSync(executor)),
  semantic_host_imports: ['wasmc:tls-core/entropy@0.0.1#fill'],
  fixed_host_domain_apis: 0,
  handshake_rounds: handshakeRounds + 1,
  entropy_calls: entropyCalls,
  adapter_writes: adapterWrites,
  adapter_reads: adapterReads,
  http_request_bytes: request.length,
  http_response_bytes: plaintext.length,
  admitted: false,
  released: false,
}));
