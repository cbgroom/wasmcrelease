import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, inspectWasm } from '../current/wasmc.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
export function inspectPure(bytes) {
  const inspected = inspectWasm(bytes);
  assert.deepEqual(inspected.imports, [], 'Host imports require application-owned explicit authority; pure execution refuses before instantiation');
  return inspected;
}
export async function executeSource(source, name, calls, expectedCompiler) {
  const carrier = JSON.parse(readFileSync(resolve(root, 'current/compiler-release.json')));
  const compiler = readFileSync(resolve(root, carrier.compiler.path));
  assert.equal(sha(compiler), expectedCompiler ?? carrier.compiler.sha256, 'independent compiler digest mismatch');
  assert.equal(sha(compiler), carrier.compiler.sha256);
  const facade = carrier.artifacts.find(r => r.path === 'current/wasmc.mjs');
  assert.equal(sha(readFileSync(resolve(root, facade.path))), facade.sha256);
  const bytes = await compile(source), inspected = inspectPure(bytes);
  const instance = await WebAssembly.instantiate(inspected.module, {});
  assert.equal(typeof instance.exports[name], 'function');
  return { accepted: true, compiler_sha256: sha(compiler), source_sha256: sha(source), core_bytes: bytes.length,
    core_sha256: sha(bytes), imports: inspected.imports, export: name,
    calls: calls.map(args => ({ arguments: args, result: instance.exports[name](...args) })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = {}; for (let i = 2; i < process.argv.length; i += 2) opts[process.argv[i]] = process.argv[i + 1];
  assert.ok(opts['--source'] && opts['--export'] && opts['--calls'], 'usage: wasmc-agent-execute.mjs --source PATH --export NAME --calls JSON [--expected-compiler-sha256 SHA256]');
  const calls = JSON.parse(opts['--calls']); assert.ok(Array.isArray(calls) && calls.every(Array.isArray));
  const report = await executeSource(readFileSync(opts['--source'], 'utf8'), opts['--export'], calls, opts['--expected-compiler-sha256']);
  console.log(JSON.stringify(report, (_, value) => typeof value === 'bigint' ? { bigint_decimal: value.toString() } : value));
}
