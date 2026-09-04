const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesAt(memory, ptr, len) {
  return new Uint8Array(memory.buffer, Number(ptr), Number(len)).slice();
}

function textAt(memory, ptr, len) {
  return textDecoder.decode(bytesAt(memory, ptr, len));
}

function requiredExport(exports, name) {
  const value = exports[name];
  if (typeof value === 'undefined') throw new Error(`compiler.wasm missing export ${name}`);
  return value;
}

export async function loadCompiler(host, compilerPath = host.resolve('compiler.wasm')) {
  const bytes = await host.readFile(compilerPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return new WasmcCompiler(instance.exports, compilerPath, bytes.length);
}

export class WasmcCompiler {
  constructor(exports, path, bytes) {
    this.exports = exports;
    this.path = path;
    this.bytes = bytes;
    this.memory = requiredExport(exports, 'memory');
    this.alloc = requiredExport(exports, 'wasmc_alloc');
    this.compileRaw = requiredExport(exports, 'wasmc_compile');
    this.outputPtr = requiredExport(exports, 'wasmc_output_ptr');
    this.outputLen = requiredExport(exports, 'wasmc_output_len');
    this.errorPtr = requiredExport(exports, 'wasmc_error_ptr');
    this.errorLen = requiredExport(exports, 'wasmc_error_len');
    this.diagnosticPtr = requiredExport(exports, 'wasmc_diagnostic_ptr');
    this.diagnosticLen = requiredExport(exports, 'wasmc_diagnostic_len');
    this.clear = typeof exports.wasmc_clear === 'function' ? exports.wasmc_clear : () => {};
  }

  compile(source) {
    this.clear();
    const input = textEncoder.encode(source);
    const ptr = Number(this.alloc(input.length));
    new Uint8Array(this.memory.buffer, ptr, input.length).set(input);
    const code = Number(this.compileRaw(ptr, input.length));
    if (code !== 0) {
      const message = textAt(this.memory, this.errorPtr(), this.errorLen()) || `compiler failed with code ${code}`;
      const diagnostic = textAt(this.memory, this.diagnosticPtr(), this.diagnosticLen());
      const error = new Error(message);
      error.code = code;
      error.diagnostic = diagnostic;
      throw error;
    }
    return bytesAt(this.memory, this.outputPtr(), this.outputLen());
  }
}

function parseArgs(args) {
  const options = { command: args[0] || 'self-test', input: null, output: null, compiler: null, json: false };
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--input') options.input = rest[++i];
    else if (arg === '--output') options.output = rest[++i];
    else if (arg === '--compiler') options.compiler = rest[++i];
    else if (arg === '--json') options.json = true;
    else if (!options.input && options.command === 'compile') options.input = arg;
    else if (!options.output && options.command === 'compile') options.output = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function assertWasm(bytes, label) {
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error(`${label} is not a WebAssembly module`);
  }
}

export async function runCli(host, args) {
  const options = parseArgs(args);
  const compiler = await loadCompiler(host, options.compiler ? host.resolve(options.compiler) : undefined);
  if (options.command === 'self-test') {
    const source = 'package local:runtime_smoke; interface api { run: func(a: s32, b: s32) -> s32 { return a + b; } } world app { export api; }';
    const wasm = compiler.compile(source);
    assertWasm(wasm, 'self-test output');
    host.stdout(JSON.stringify({ schema: 'wasmc.runtime-js-self-test/v0', accepted: true, runtime: host.name, compiler_bytes: compiler.bytes, output_bytes: wasm.length }, null, 2));
    return;
  }
  if (options.command === 'compile') {
    if (!options.input || !options.output) throw new Error('compile requires --input <source.wasmc> --output <output.wasm>');
    const source = textDecoder.decode(await host.readFile(host.resolve(options.input)));
    const wasm = compiler.compile(source);
    assertWasm(wasm, 'compile output');
    await host.writeFile(host.resolve(options.output), wasm);
    host.stdout(JSON.stringify({ schema: 'wasmc.runtime-js-compile/v0', accepted: true, runtime: host.name, input: options.input, output: options.output, output_bytes: wasm.length }, null, 2));
    return;
  }
  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    host.stdout('usage: bootstrap.mjs <self-test|compile> [--compiler compiler.wasm] [--input source.wasmc --output output.wasm]');
    return;
  }
  throw new Error(`unknown command: ${options.command}`);
}
