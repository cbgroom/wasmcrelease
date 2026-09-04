const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const runtimeErrorSchema = 'wasmc.runtime-js-error/v0';

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

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function parseCompilerDiagnostic(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (_) {
    return null;
  }
}

export function runtimeCliErrorReport(error, { runtime = 'unknown', command = null } = {}) {
  const diagnosticText = typeof error?.diagnostic === 'string' ? error.diagnostic : '';
  const diagnostic =
    error?.diagnosticObject !== null && typeof error?.diagnosticObject === 'object'
      ? error.diagnosticObject
      : parseCompilerDiagnostic(diagnosticText);
  const compilerStatus = Number.isInteger(error?.code) ? Number(error.code) : null;
  return {
    schema: runtimeErrorSchema,
    accepted: false,
    runtime,
    command,
    process_exit_code: 1,
    compiler_status: compilerStatus,
    error: {
      message: errorMessage(error),
      diagnostic,
      diagnostic_state: diagnostic ? 'parsed' : diagnosticText ? 'malformed-json' : 'absent'
    }
  };
}

export function formatRuntimeCliError(error, options = {}) {
  if (options.jsonErrors === true) {
    return JSON.stringify(runtimeCliErrorReport(error, options), null, 2);
  }
  return errorMessage(error);
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
      error.name = 'WasmcCompileError';
      error.code = code;
      error.diagnostic = diagnostic;
      error.diagnosticObject = parseCompilerDiagnostic(diagnostic);
      throw error;
    }
    return bytesAt(this.memory, this.outputPtr(), this.outputLen());
  }
}

function parseArgs(args) {
  const options = {
    command: args[0] || 'self-test',
    input: null,
    output: null,
    compiler: null,
    json: false,
    jsonErrors: false
  };
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--input') options.input = rest[++i];
    else if (arg === '--output') options.output = rest[++i];
    else if (arg === '--compiler') options.compiler = rest[++i];
    else if (arg === '--json') {
      options.json = true;
      options.jsonErrors = true;
    }
    else if (arg === '--json-errors') options.jsonErrors = true;
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
    host.stdout('usage: bootstrap.mjs <self-test|compile> [--compiler compiler.wasm] [--input source.wasmc --output output.wasm] [--json-errors]');
    return;
  }
  throw new Error(`unknown command: ${options.command}`);
}
