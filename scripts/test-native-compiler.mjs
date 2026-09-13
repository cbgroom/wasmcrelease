import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from '../current/wasmc.mjs';
const binary = resolve(process.argv[2] ?? 'sdk/wasmc-native-compiler/target/debug/wasmc-wasmi');
const directory = await mkdtemp(join(tmpdir(), 'wasmc-native-parity-'));
try {
  let cases = 0;
  const executions = [
    [[5, 6], 17, {}], [[5, 10], 10, {}], [[-9], 10, {}],
    [[4, 5], 9, {}], [[7], 15, { host: { double: value => value * 2 } }],
  ];
  for (const name of ['01_add', '02_control_flow', '03_private_function', '04_record', '05_host_import']) {
    const input = resolve(`examples/agent-start/${name}.wasmc`);
    const output = join(directory, `${name}.wasm`);
    const native = spawnSync(binary, ['compile', input, output], { timeout: 30000, encoding: 'utf8' });
    if (native.status !== 0) throw new Error(`native failed: ${native.stderr}`);
    const expected = await compile(await readFile(input, 'utf8'));
    if (!Buffer.from(expected).equals(await readFile(output))) throw new Error(`${name}: byte drift`);
    const [args, expectedResult, imports] = executions[cases];
    const instance = await WebAssembly.instantiate(await readFile(output), imports);
    if (instance.instance.exports.run(...args) !== expectedResult) throw new Error(`${name}: execution mismatch`);
    const clobber = spawnSync(binary, ['compile', input, output], { timeout: 30000 });
    if (clobber.status === 0 || !Buffer.from(expected).equals(await readFile(output))) throw new Error('clobber accepted');
    cases++;
  }
  console.log(JSON.stringify({ accepted: true, byte_parity_cases: cases, execution_cases: cases, no_clobber_cases: cases }));
} finally { await rm(directory, { recursive: true, force: true }); }
