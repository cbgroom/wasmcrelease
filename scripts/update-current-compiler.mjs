#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [candidateArgument, expectedSha256] = process.argv.slice(2);
if (!candidateArgument || !/^[0-9a-f]{64}$/.test(expectedSha256 ?? '')) {
  throw new Error('usage: update-current-compiler.mjs CANDIDATE_WASM EXPECTED_SHA256');
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const candidatePath = resolve(candidateArgument);
const candidateInfo = await stat(candidatePath);
if (!candidateInfo.isFile()) throw new Error('compiler candidate must be a regular file');
const candidate = await readFile(candidatePath);
if (candidate.length < 8 || !candidate.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
  throw new Error('compiler candidate is not Core Wasm');
}
if (sha256(candidate) !== expectedSha256) throw new Error('compiler candidate digest mismatch');

const module = new WebAssembly.Module(candidate);
if (WebAssembly.Module.imports(module).length !== 0) throw new Error('compiler candidate must be import-free');
const exports = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
for (const name of ['memory', 'wasmc_alloc', 'wasmc_compile', 'wasmc_output_ptr', 'wasmc_output_len', 'wasmc_error_ptr', 'wasmc_error_len', 'wasmc_clear']) {
  if (!exports.has(name)) throw new Error(`compiler candidate is missing ${name}`);
}

function replaceEmbeddedCompiler(source, previousBytes) {
  const marker = 'function decodeEmbeddedCompiler() {';
  const functionStart = source.indexOf(marker);
  if (functionStart < 0) throw new Error('embedded compiler decoder is missing');
  const prefix = 'const binary = atob("';
  const encodedStart = source.indexOf(prefix, functionStart);
  if (encodedStart < 0) throw new Error('embedded compiler payload is missing');
  const payloadStart = encodedStart + prefix.length;
  const payloadEnd = source.indexOf('");', payloadStart);
  if (payloadEnd < 0) throw new Error('embedded compiler payload is unterminated');
  const previousEmbedded = Buffer.from(source.slice(payloadStart, payloadEnd), 'base64');
  if (!previousEmbedded.equals(previousBytes)) {
    throw new Error('embedded compiler payload does not match current/wasmc_compiler.wasm');
  }
  return `${source.slice(0, payloadStart)}${candidate.toString('base64')}${source.slice(payloadEnd)}`;
}

async function atomicWrite(path, bytes, mode = undefined) {
  const temporary = join(dirname(path), `.${basename(path)}.tmp`);
  await writeFile(temporary, bytes, mode === undefined ? undefined : { mode });
  await rename(temporary, path);
}

const currentCompilerPath = join(root, 'current/wasmc_compiler.wasm');
const previous = await readFile(currentCompilerPath);
const esmPath = join(root, 'current/wasmc.mjs');
const globalPath = join(root, 'current/wasmc.global.js');
const esm = replaceEmbeddedCompiler(await readFile(esmPath, 'utf8'), previous);
const global = replaceEmbeddedCompiler(await readFile(globalPath, 'utf8'), previous);

await atomicWrite(esmPath, esm, 0o755);
await atomicWrite(globalPath, global, 0o644);
await atomicWrite(currentCompilerPath, candidate, 0o644);

console.log(JSON.stringify({
  accepted: true,
  candidate: candidatePath,
  bytes: candidate.length,
  sha256: expectedSha256,
  imports: 0,
  updated: ['current/wasmc_compiler.wasm', 'current/wasmc.mjs', 'current/wasmc.global.js'],
  runtime_package: 'unchanged; use runtime-package-compiler-admit for strict runtime admission',
}));
