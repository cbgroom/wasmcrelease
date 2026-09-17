import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from '../current/wasmc.mjs';

const binary = resolve(process.argv[2] ?? `sdk/wasmc-native-compiler/target/debug/${process.platform === 'win32' ? 'wasmc.exe' : 'wasmc'}`);
const directory = await mkdtemp(join(tmpdir(), 'wasmc-native-parity-'));
function command(args, options = {}) {
  return spawnSync(binary, args, { timeout: 30000, encoding: 'utf8', ...options });
}
try {
  let parity = 0;
  let execution = 0;
  let nativeExecution = 0;
  let noClobber = 0;
  const cases = [
    ['01_add', ['5', '6'], '17', true],
    ['02_control_flow', ['5', '10'], '10', true],
    ['03_private_function', ['-9'], '10', true],
    ['04_record', ['4', '5'], '9', true],
    ['05_host_import', ['7'], '15', false],
  ];
  for (const [name, args, expectedResult, canRunDirect] of cases) {
    const input = resolve(`examples/agent-start/${name}.wasmc`);
    const output = join(directory, `${name}.wasm`);
    const built = command(['build', input, '-o', output]);
    if (built.status !== 0) throw new Error(`portable build failed: ${built.stderr}`);
    const expected = await compile(await readFile(input, 'utf8'));
    if (!Buffer.from(expected).equals(await readFile(output))) throw new Error(`${name}: byte drift`);
    parity++;

    const clobber = command(['build', input, '-o', output]);
    if (clobber.status === 0 || !Buffer.from(expected).equals(await readFile(output))) throw new Error('portable clobber accepted');
    noClobber++;

    if (!canRunDirect) continue;
    const run = command(['run', input, ...args]);
    if (run.status !== 0 || run.stdout.trim() !== expectedResult) {
      throw new Error(`${name}: Wasmi run mismatch: status=${run.status} stdout=${run.stdout} stderr=${run.stderr}`);
    }
    execution++;

    const native = join(directory, process.platform === 'win32' ? `${name}.exe` : `${name}.native`);
    const cache = join(directory, `cache-${name}`);
    const nativeBuild = command(['build', '--target', 'native', input, '-o', native], {
      env: { ...process.env, WASMC_CACHE_DIR: cache },
    });
    if (nativeBuild.status !== 0) throw new Error(`${name}: native build failed: ${nativeBuild.stderr}`);
    const nativeRun = spawnSync(native, args, { timeout: 30000, encoding: 'utf8' });
    if (nativeRun.status !== 0 || nativeRun.stdout.trim() !== expectedResult) {
      throw new Error(`${name}: native run mismatch: status=${nativeRun.status} stdout=${nativeRun.stdout} stderr=${nativeRun.stderr}`);
    }
    nativeExecution++;

    const nativeClobber = command(['build', '--target', 'native', input, '-o', native], {
      env: { ...process.env, WASMC_CACHE_DIR: cache },
    });
    if (nativeClobber.status === 0) throw new Error(`${name}: native clobber accepted`);
    noClobber++;
  }
  console.log(JSON.stringify({
    accepted: true,
    byte_parity_cases: parity,
    wasmi_run_cases: execution,
    native_execution_cases: nativeExecution,
    no_clobber_cases: noClobber,
  }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
