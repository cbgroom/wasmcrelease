import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { hostname } from 'node:os';

export const sha = value => createHash('sha256').update(value).digest('hex');
export const digest = value => sha(Buffer.from(JSON.stringify(value)));
export const json = async path => JSON.parse(await readFile(path, 'utf8'));
export const exists = async path => { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };

export function inside(root, path) {
  assert.equal(typeof path, 'string');
  assert.ok(path && !isAbsolute(path), 'relative path required');
  const result = resolve(root, path);
  const suffix = relative(resolve(root), result);
  assert.ok(suffix && suffix !== '..' && !suffix.startsWith('../') && !isAbsolute(suffix), 'path escapes root: ' + path);
  return result;
}

export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, path);
}

export async function writeChanged(path, bytes) {
  const desired = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try { if ((await readFile(path)).equals(desired)) return false; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, desired);
  return true;
}

export async function inventory(root, prefix = '') {
  const result = {};
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const rel = prefix ? prefix + '/' + name : name;
    const path = inside(root, rel);
    const info = await lstat(path);
    assert.ok(!info.isSymbolicLink(), 'symlink forbidden: ' + rel);
    if (info.isDirectory()) Object.assign(result, await inventory(root, rel));
    else {
      assert.ok(info.isFile(), 'non-regular file: ' + rel);
      result[rel] = { bytes: info.size, sha256: sha(await readFile(path)) };
    }
  }
  return result;
}


// Packaging metadata only: executable artifacts and generated SDK source stay exact.
// Explicit caller input enters the refresh key; it is never inferred from a cache.
export async function attachReleaseLicense(root, bytes, expectedSha256) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 262144);
  assert.equal(sha(bytes), expectedSha256, 'release license pin mismatch');
  const identifier = bytes.toString('utf8').split('\n')[0].trim();
  assert.equal(identifier, 'WAsmC Research-Only Non-Commercial License 1.0');
  await inventory(root); // reject linked or non-regular producer output before any write
  const manifest = await json(join(root, 'lib.json'));
  if (manifest.license) {
    assert.equal(manifest.license.identifier, identifier, 'existing license authority differs');
    assert.equal(manifest.license.files?.[0]?.sha256, expectedSha256, 'existing license snapshot differs');
  }
  await writeChanged(join(root, 'LICENSE'), bytes);
  const changed = new Map();
  for (const sdk of Object.values(manifest.bindings ?? {})) {
    if (!sdk.cargo_toml) continue;
    const path = sdk.cargo_toml.path;
    assert.match(path, /^bindings\/[^/]+\/Cargo\.toml$/);
    const cargo = (await readFile(inside(root, path), 'utf8'));
    assert.ok(cargo.startsWith('[package]\n'), 'SDK package manifest required');
    const lines = cargo.split('\n');
    const end = lines.findIndex((line, index) => index > 0 && /^\[/.test(line));
    assert.ok(end > 0, 'SDK manifest section boundary required');
    const section = lines.slice(1, end);
    const existing = section.filter(line => /^license(?:-file)?\s*=/.test(line));
    assert.ok(existing.length === 0 || (existing.length === 1 && existing[0] === 'license-file = "../../LICENSE"'),
      'SDK existing license authority differs');
    if (!existing.length) lines.splice(1, 0, 'license-file = "../../LICENSE"');
    const result = Buffer.from(lines.join('\n'));
    await writeChanged(inside(root, path), result);
    changed.set(path, {bytes:result.length,sha256:sha(result)});
  }
  const update = value => {
    if (!value || typeof value !== 'object') return;
    if (changed.has(value.path) && typeof value.sha256 === 'string') {
      value.sha256 = changed.get(value.path).sha256;
      if ('bytes' in value) value.bytes = changed.get(value.path).bytes;
    }
    for (const child of Object.values(value)) update(child);
  };
  update(manifest);
  manifest.license = {schema:'wasmc.lib-license/v1',identifier,
    files:[{path:'LICENSE',bytes:bytes.length,sha256:expectedSha256}]};
  await atomicJson(join(root, 'lib.json'), manifest);
}

export function verifyReleaseLicense(manifest, files) {
  if (!manifest.license) return;
  const license = manifest.license;
  assert.equal(license.schema, 'wasmc.lib-license/v1');
  assert.equal(license.identifier, 'WAsmC Research-Only Non-Commercial License 1.0');
  assert.deepEqual(license.files?.map(f => f.path), ['LICENSE']);
  const pin = license.files[0];
  assert.ok(pin.bytes > 0 && pin.bytes <= 262144);
  assert.deepEqual(files.LICENSE, {bytes:pin.bytes,sha256:pin.sha256}, 'license snapshot drift');
}

export async function verifyRoot(root, id, version, profile = 'value', resourceCore = false) {
  const files = await inventory(root);
  const manifest = await json(join(root, 'lib.json'));
  assert.equal(manifest.id, id);
  assert.equal(manifest.version, version);
  verifyReleaseLicense(manifest, files);
  if (profile === 'native') {
    assert.equal(manifest.schema, 'wasmc.lib-native/v2');
    assert.equal(manifest.profile, 'native');
    assert.equal(manifest.native?.wasm_lowered, false);
    assert.equal(manifest.lifecycle?.runtime_qualified, false);
    assert.equal(manifest.lifecycle?.admitted, false);
    assert.ok(Array.isArray(manifest.implementation) && manifest.implementation.length > 0);
    const descriptors = [manifest.wit, ...manifest.implementation,
      ...[manifest.artifact, manifest.native_boundary].filter(Boolean), ...(manifest.license?.files ?? [])];
    for (const item of descriptors) {
      inside(root, item.path);
      assert.ok(files[item.path], id + ': native file missing ' + item.path);
      assert.equal(files[item.path].sha256, item.sha256, id + ': native digest mismatch ' + item.path);
      assert.equal(files[item.path].bytes, item.bytes, id + ': native size mismatch ' + item.path);
    }
    assert.deepEqual(Object.keys(files).sort(), ['lib.json', ...new Set(descriptors.map(d => d.path))].sort(),
      id + ': undeclared native package files');
    if (manifest.native_boundary) {
      const descriptor = await json(join(root, manifest.native_boundary.path));
      assert.equal(descriptor.adapter.path, manifest.artifact.path);
      assert.equal(descriptor.adapter.sha256, manifest.artifact.sha256);
    }
    return { files, manifest, manifest_sha256: files['lib.json'].sha256 };
  }
  assert.ok(['value', 'resource', 'host'].includes(profile), 'unsupported verification profile');
  if (profile === 'value') {
    assert.equal(manifest.bindings?.rust_core?.schema, 'wasmc.lib-rust-canonical-core-sdk/v1');
  }
  assert.equal(manifest.bindings?.rust_component?.schema, 'wasmc.lib-rust-component-sdk/v0');
  if (resourceCore) {
    assert.equal(profile, 'resource');
    assert.equal(manifest.bindings?.rust_core?.schema, 'wasmc.lib-rust-core-sdk/v0');
    assert.ok(files['typed-resource-plan.json'], id + ': complete resource Core plan missing');
  }
  const allowed = profile === 'value' || resourceCore ? ['rust_component', 'rust_core'] : ['rust_component'];
  assert.deepEqual(Object.keys(manifest.bindings).sort(), allowed,
    id + ': complete profile must not advertise partial or unknown SDK views');
  for (const name of ['artifact.wasm', 'component.wasm', 'core-abi.json', 'lib.wit']) {
    assert.ok(files[name], id + ': missing generated file ' + name);
  }
  for (const binding of Object.values(manifest.bindings)) {
    assert.ok(binding.cargo_toml?.path && binding.source?.path, id + ': incomplete SDK descriptor');
    assert.ok(files[binding.cargo_toml.path] && files[binding.source.path], id + ': incomplete SDK files');
  }
  for (const [key, name] of [['artifact', 'artifact.wasm'], ['component', 'component.wasm'], ['core_abi', 'core-abi.json']]) {
    assert.equal(files[name].sha256, manifest[key]?.sha256, id + ': descriptor/hash mismatch ' + name);
  }
  // Verify every local path+digest descriptor, including generated SDK files.
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string' && typeof value.sha256 === 'string') {
      inside(root, value.path);
      assert.ok(files[value.path], id + ': missing manifest file ' + value.path);
      assert.equal(files[value.path].sha256, value.sha256, id + ': manifest file digest mismatch ' + value.path);
    }
    for (const child of Object.values(value)) walk(child);
  };
  // Build input paths are workspace provenance, not files in the published Root.
  for (const key of ['artifact', 'component', 'core_abi', 'wit', 'bindings', 'agent', 'license']) walk(manifest[key]);
  return { files, manifest, manifest_sha256: files['lib.json'].sha256 };
}

export async function verifyCache(entry, key, spec) {
  const seal = await json(join(entry, 'seal.json'));
  assert.equal(seal.schema, 'wasmc.lib-refresh-cache-entry/v2');
  assert.equal(seal.key, key);
  assert.equal(seal.id, spec.id);
  const current = await verifyRoot(join(entry, 'package'), spec.id, spec.version, spec.profile ?? 'value', Boolean(spec.core_resource));
  assert.deepEqual(current.files, seal.files, spec.id + ': CACHE_INTEGRITY inventory mismatch');
  return current;
}

export async function acquireWriter(root) {
  await mkdir(root, { recursive: true });
  const path = join(root, 'writer.lock');
  const owner = { schema: 'wasmc.lib-refresh-writer/v2', pid: process.pid, hostname: hostname(), token: randomUUID(), started_at: new Date().toISOString() };
  let handle;
  try { handle = await open(path, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const held = await json(path).catch(() => ({ state: 'unreadable' }));
    throw new Error('CACHE_BUSY: inspect the recorded writer before recovery: ' + JSON.stringify(held));
  }
  await handle.writeFile(JSON.stringify(owner));
  await handle.close();
  return async () => {
    assert.equal((await json(path)).token, owner.token, 'writer lock ownership changed');
    await unlink(path);
  };
}

export async function command(command, args, options) {
  const logs = options.logs;
  if (logs) await mkdir(dirname(logs), { recursive: true });
  const stdoutFile = logs ? createWriteStream(logs + '.stdout.log', { flags: 'wx' }) : null;
  const stderrFile = logs ? createWriteStream(logs + '.stderr.log', { flags: 'wx' }) : null;
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    let stdout = '', stderr = '', timedOut = false;
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, detached: process.platform !== 'win32' });
    let killTimer;
    const stop = () => {
      if (!child.pid) return;
      const target = process.platform === 'win32' ? child.pid : -child.pid;
      try { process.kill(target, 'SIGTERM'); } catch {}
      killTimer ??= setTimeout(() => { try { process.kill(target, 'SIGKILL'); } catch {} }, 1000);
    };
    const abort = () => stop();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, options.timeout ?? 300000);
    child.stdout.on('data', bytes => { stdoutFile?.write(bytes); stdout = (stdout + bytes.toString()).slice(-1048576); });
    child.stderr.on('data', bytes => { stderrFile?.write(bytes); stderr = (stderr + bytes.toString()).slice(-1048576); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', async (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer);
      options.signal?.removeEventListener('abort', abort);
      await Promise.all([stdoutFile, stderrFile].filter(Boolean).map(stream => new Promise(done => stream.end(done))));
      const result = { command, args, exit_code: code, signal, timed_out: timedOut, duration_ms: Date.now() - started, stdout: stdout.trim(), stderr: stderr.trim() };
      if (logs) await atomicJson(logs + '.command.json', result);
      if (code !== 0 || timedOut || options.signal?.aborted) {
        const error = new Error('COMMAND_FAILED: ' + command + ' exit=' + code + '\n' + stderr.slice(-8000));
        error.result = result;
        reject(error);
      } else resolvePromise(result);
    });
  });
}
