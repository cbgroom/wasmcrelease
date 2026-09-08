#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libsRoot = join(root, 'libs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function localPath(libRoot, relative) {
  if (typeof relative !== 'string' || !relative) throw new Error('Lib path must be a non-empty string');
  const path = resolve(libRoot, normalize(relative));
  if (!path.startsWith(`${resolve(libRoot)}${sep}`)) throw new Error(`Lib path escapes package: ${relative}`);
  return path;
}

async function verifyFile(libRoot, row, label, expectedFormat = null) {
  if (!row || (expectedFormat && row.format !== expectedFormat)) throw new Error(`${label}: invalid metadata`);
  const bytes = await readFile(localPath(libRoot, row.path));
  if (Number.isInteger(row.bytes) && bytes.length !== row.bytes) throw new Error(`${label}: byte length mismatch`);
  if (sha(bytes) !== row.sha256) throw new Error(`${label}: SHA-256 mismatch`);
  return bytes;
}

const entries = (await readdir(libsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (entries.length === 0) throw new Error('no Lib packages found');

for (const name of entries) {
  const libRoot = join(libsRoot, name);
  const manifest = JSON.parse(await readFile(join(libRoot, 'lib.json'), 'utf8'));
  if (manifest.schema !== 'wasmc.lib/v0') throw new Error(`${name}: unsupported schema`);
  if (manifest.id !== basename(libRoot)) throw new Error(`${name}: id does not match directory`);

  const wit = await verifyFile(libRoot, manifest.wit, `${name}: WIT`);
  const witText = new TextDecoder().decode(wit);
  if (!witText.includes(`package ${manifest.wit.package};`)) throw new Error(`${name}: WIT package identity mismatch`);
  if (!new RegExp(`\\bworld\\s+${manifest.wit.world.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(witText)) {
    throw new Error(`${name}: WIT world identity mismatch`);
  }

  const artifact = await verifyFile(libRoot, manifest.artifact, `${name}: Core artifact`, 'core-wasm');
  const module = await WebAssembly.compile(artifact);
  const component = await verifyFile(libRoot, manifest.component, `${name}: Component artifact`, 'component-wasm');
  if (component.length < 8 || component[0] !== 0 || component[1] !== 0x61 || component[2] !== 0x73 || component[3] !== 0x6d) {
    throw new Error(`${name}: Component artifact is not a WebAssembly binary`);
  }

  await verifyFile(libRoot, manifest.agent?.skill, `${name}: Agent Skill`);
  await verifyFile(libRoot, manifest.agent?.delta, `${name}: Agent delta`);
  console.log(`PASS ${name}: core=${artifact.length} component=${component.length} imports=${WebAssembly.Module.imports(module).length} exports=${WebAssembly.Module.exports(module).length}`);
}

console.log(`PASS Lib package contracts: count=${entries.length}`);
