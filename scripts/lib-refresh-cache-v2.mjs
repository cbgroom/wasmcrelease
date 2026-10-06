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

export async function verifyRoot(root, id, version) {
  const files = await inventory(root);
  const manifest = await json(join(root, 'lib.json'));
  assert.equal(manifest.id, id);
  assert.equal(manifest.version, version);
  assert.equal(manifest.bindings?.rust_core?.schema, 'wasmc.lib-rust-canonical-core-sdk/v1');
  assert.equal(manifest.bindings?.rust_component?.schema, 'wasmc.lib-rust-component-sdk/v0');
  for (const name of ['artifact.wasm', 'component.wasm', 'core-abi.json', 'lib.wit',
    'bindings/rust-core/Cargo.toml', 'bindings/rust-core/src/lib.rs',
    'bindings/rust-component/Cargo.toml', 'bindings/rust-component/src/lib.rs']) {
    assert.ok(files[name], id + ': missing generated file ' + name);
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
  for (const key of ['artifact', 'component', 'core_abi', 'wit', 'bindings', 'agent']) walk(manifest[key]);
  return { files, manifest, manifest_sha256: files['lib.json'].sha256 };
}

export async function verifyCache(entry, key, spec) {
  const seal = await json(join(entry, 'seal.json'));
  assert.equal(seal.schema, 'wasmc.lib-refresh-cache-entry/v2');
  assert.equal(seal.key, key);
  assert.equal(seal.id, spec.id);
  const current = await verifyRoot(join(entry, 'package'), spec.id, spec.version);
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
