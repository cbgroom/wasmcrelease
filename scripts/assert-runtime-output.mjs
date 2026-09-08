#!/usr/bin/env node

function runtimeArgs() {
  if (typeof globalThis.Deno !== 'undefined') return globalThis.Deno.args;
  if (typeof globalThis.Bun !== 'undefined') return globalThis.Bun.argv.slice(2);
  return process.argv.slice(2);
}

async function readBytes(path) {
  if (typeof globalThis.Deno !== 'undefined') return globalThis.Deno.readFile(path);
  const { readFile } = await import('node:fs/promises');
  return readFile(path);
}

const [path] = runtimeArgs();
if (!path) throw new Error('usage: assert-runtime-output.mjs <compiled.wasm>');

const bytes = await readBytes(path);
if (!WebAssembly.validate(bytes)) throw new Error(`${path}: output is not valid Core Wasm`);

const module = await WebAssembly.compile(bytes);
const imports = WebAssembly.Module.imports(module);
if (imports.length !== 0) throw new Error(`${path}: unexpected imports ${JSON.stringify(imports)}`);

const instance = await WebAssembly.instantiate(module, {});
if (typeof instance.exports.run !== 'function') throw new Error(`${path}: missing run export`);
const actual = instance.exports.run(6, 18);
if (actual !== 42) throw new Error(`${path}: expected run(6, 18)=42, got ${actual}`);

console.log(`PASS runtime output: run(6,18)=${actual}, wasm=${bytes.length} bytes, imports=0`);
