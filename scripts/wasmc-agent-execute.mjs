import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
export function inspectPure(bytes) {
  const module = new WebAssembly.Module(bytes);
  const inspected = { module, imports: WebAssembly.Module.imports(module), exports: WebAssembly.Module.exports(module) };
  assert.deepEqual(inspected.imports, [], 'Host imports require application-owned explicit authority; pure execution refuses before instantiation');
  return inspected;
}
const coreValue = value => {
  if (value !== null && typeof value === 'object') {
    assert.deepEqual(Object.keys(value), ['bigint_decimal'], 'Core i64 JSON values require exactly one bigint_decimal field');
    assert.equal(typeof value.bigint_decimal, 'string', 'bigint_decimal must be a decimal string');
    assert.match(value.bigint_decimal, /^-?(0|[1-9][0-9]*)$/, 'bigint_decimal must be an exact decimal integer');
    const integer = BigInt(value.bigint_decimal);
    assert.ok(integer >= -(1n << 63n) && integer <= (1n << 64n) - 1n, 'bigint_decimal is outside the signed/unsigned 64-bit input range');
    return integer;
  }
  assert.ok(['number', 'boolean', 'bigint'].includes(typeof value), 'Core call arguments must be scalar values');
  return value;
};
const oracleValue = value => Array.isArray(value) ? value.map(oracleValue) : coreValue(value);
export async function executeSource(source, name, calls, expectedCompiler, expectedResults) {
  const carrier = JSON.parse(readFileSync(resolve(root, 'current/compiler-release.json')));
  const compiler = readFileSync(resolve(root, carrier.compiler.path));
  assert.equal(sha(compiler), expectedCompiler ?? carrier.compiler.sha256, 'independent compiler digest mismatch');
  assert.equal(sha(compiler), carrier.compiler.sha256);
  const facade = carrier.artifacts.find(r => r.path === 'current/wasmc.mjs');
  assert.equal(sha(readFileSync(resolve(root, facade.path))), facade.sha256, 'facade digest mismatch before module import');
  const facadeUrl = pathToFileURL(resolve(root, facade.path));
  facadeUrl.searchParams.set('sha256', facade.sha256);
  const { compile } = await import(facadeUrl.href);
  assert.ok(Array.isArray(calls) && calls.every(Array.isArray), 'calls must be arrays of positional argument arrays');
  const argumentsByCall = calls.map(args => args.map(coreValue));
  const oracle = expectedResults === undefined ? undefined : oracleValue(expectedResults);
  const bytes = await compile(source, { compilerWasmBytes: compiler }), inspected = inspectPure(bytes);
  const instance = await WebAssembly.instantiate(inspected.module, {});
  assert.equal(typeof instance.exports[name], 'function');
  const executed = argumentsByCall.map(args => ({ arguments: args, result: instance.exports[name](...args) }));
  if (oracle !== undefined) assert.deepEqual(executed.map(row => row.result), oracle, 'execution results differ from caller-supplied oracle');
  return { accepted: true, compiler_sha256: sha(compiler), source_sha256: sha(source), core_bytes: bytes.length,
    core_sha256: sha(bytes), imports: inspected.imports, export: name,
    calls: executed, expected_results_verified: expectedResults !== undefined };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = {}; for (let i = 2; i < process.argv.length; i += 2) opts[process.argv[i]] = process.argv[i + 1];
  assert.ok(opts['--source'] && opts['--export'] && opts['--calls'], 'usage: wasmc-agent-execute.mjs --source PATH --export NAME --calls JSON [--expected-compiler-sha256 SHA256] [--expected-results JSON]');
  const calls = JSON.parse(opts['--calls']); assert.ok(Array.isArray(calls) && calls.every(Array.isArray));
  try {
    const report = await executeSource(readFileSync(opts['--source'], 'utf8'), opts['--export'], calls, opts['--expected-compiler-sha256'], opts['--expected-results'] === undefined ? undefined : JSON.parse(opts['--expected-results']));
    console.log(JSON.stringify(report, (_, value) => typeof value === 'bigint' ? { bigint_decimal: value.toString() } : value));
  } catch (error) {
    console.error(JSON.stringify({ accepted: false, error: error.message.split('\n')[0], actual: error.actual, expected: error.expected }));
    process.exitCode = 1;
  }
}
