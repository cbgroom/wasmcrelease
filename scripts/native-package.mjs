import { readFile, writeFile, mkdir, copyFile, readdir, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const targets = {
  'x86_64-unknown-linux-gnu': ['linux', 'x64'],
  'aarch64-unknown-linux-gnu': ['linux', 'arm64'],
  'x86_64-apple-darwin': ['darwin', 'x64'],
  'aarch64-apple-darwin': ['darwin', 'arm64'],
  'x86_64-pc-windows-msvc': ['win32', 'x64'],
  'aarch64-pc-windows-msvc': ['win32', 'arm64'],
};
const compilerDigest = '93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function command(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(`${program} failed: ${result.stderr}`);
  return result.stdout.trim();
}
export async function verify(directory, source, target) {
  const profile = targets[target];
  if (!profile || profile[0] !== process.platform || profile[1] !== process.arch) throw new Error('native target mismatch');
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const binary = process.platform === 'win32' ? 'wasmc-wasmi.exe' : 'wasmc-wasmi';
  const files = [binary, 'README.md', 'Cargo.lock'];
  if (!/^[a-f0-9]{40}$/.test(source) || manifest.schema !== 'wasmc-native-package/v1' ||
      manifest.source !== source || manifest.target !== target || manifest.profile !== 'wasmi-only' ||
      manifest.compiler_sha256 !== compilerDigest || manifest.stable !== false ||
      JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(files.sort())) throw new Error('package identity mismatch');
  if (JSON.stringify((await readdir(directory)).sort()) !== JSON.stringify([...files, 'manifest.json'].sort())) throw new Error('package inventory mismatch');
  for (const file of files) {
    const bytes = await readFile(join(directory, file));
    if (manifest.files[file].sha256 !== hash(bytes) || manifest.files[file].bytes !== bytes.length) throw new Error(`package digest mismatch: ${file}`);
  }
  await chmod(join(directory, binary), 0o755);
  return resolve(directory, binary);
}
const [mode, directory, target, source] = process.argv.slice(2);
if (mode === 'build') {
  const profile = targets[target];
  if (!profile || profile[0] !== process.platform || profile[1] !== process.arch) throw new Error('not a native build');
  if (hash(await readFile('current/wasmc_compiler.wasm')) !== compilerDigest) throw new Error('compiler drift');
  if (command('git', ['rev-parse', 'HEAD']) !== source) throw new Error('source mismatch');
  const tree = command('cargo', ['+1.96.0', 'tree', '--locked', '--manifest-path', 'sdk/wasmc-native-compiler/Cargo.toml']);
  if (/wasmtime|cranelift/i.test(tree)) throw new Error('forbidden no-JIT dependency');
  const binary = process.platform === 'win32' ? 'wasmc-wasmi.exe' : 'wasmc-wasmi';
  await mkdir(directory, { recursive: false });
  await copyFile(`sdk/wasmc-native-compiler/target/release/${binary}`, join(directory, binary));
  for (const file of ['README.md', 'Cargo.lock']) await copyFile(`sdk/wasmc-native-compiler/${file}`, join(directory, file));
  const files = {};
  for (const file of [binary, 'README.md', 'Cargo.lock']) {
    const bytes = await readFile(join(directory, file));
    files[file] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ schema: 'wasmc-native-package/v1',
    source, target, profile: 'wasmi-only', compiler_sha256: compilerDigest, stable: false,
    toolchain: command('rustc', ['+1.96.0', '-Vv']), files }, null, 2) + '\n');
}
if (mode === 'build' || mode === 'verify') {
  const binary = await verify(directory, source, target);
  const receipt = JSON.parse(command(process.execPath, ['scripts/test-native-compiler.mjs', binary]));
  if (!receipt.accepted || receipt.byte_parity_cases !== 5 || receipt.execution_cases !== 5 || receipt.no_clobber_cases !== 5) throw new Error('invalid behavior receipt');
  console.log(JSON.stringify({ accepted: true, source, target, profile: 'wasmi-only', ...receipt }));
}
