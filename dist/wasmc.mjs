const REQUIRED_COMPILER_EXPORTS = [
  "memory",
  "wasmc_alloc",
  "wasmc_compile",
  "wasmc_output_ptr",
  "wasmc_output_len",
  "wasmc_error_ptr",
  "wasmc_error_len",
  "wasmc_clear",
];

function copyBytes(memory, pointer, length) {
  return new Uint8Array(memory.buffer, pointer, length).slice();
}

function copyText(memory, pointer, length) {
  return new TextDecoder().decode(copyBytes(memory, pointer, length));
}

export function inspectWasm(wasmBytes) {
  const module = new WebAssembly.Module(wasmBytes);
  return {
    module,
    imports: WebAssembly.Module.imports(module),
    exports: WebAssembly.Module.exports(module),
  };
}

function compareUtf8(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return a.length - b.length;
}

function validatePackageSourceName(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("WAsmC package source name must be a non-empty string");
  }
  if (name.includes("\0")) {
    throw new TypeError(`WAsmC package source \`${name}\` must not contain NUL`);
  }
}

export function flattenWasmcPackage(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("WAsmC package must contain at least one source file");
  }
  const ordered = files.map((file) => {
    if (file === null || typeof file !== "object") {
      throw new TypeError("WAsmC package files must be { name, source } objects");
    }
    validatePackageSourceName(file.name);
    if (typeof file.source !== "string") {
      throw new TypeError(`WAsmC package source \`${file.name}\` must be a string`);
    }
    return { name: file.name, source: file.source };
  }).sort((left, right) => compareUtf8(left.name, right.name));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1].name === ordered[index].name) {
      throw new TypeError(
        `duplicate WAsmC package source \`${ordered[index].name}\``,
      );
    }
  }
  return ordered
    .map(({ source }) => (source.endsWith("\n") ? source : `${source}\n`))
    .join("");
}

export class WasmcBrowserCompiler {
  static async create(compilerWasmBytes) {
    const inspected = inspectWasm(compilerWasmBytes);
    if (inspected.imports.length !== 0) {
      throw new Error("wasmc.wasm must not require ambient host imports");
    }
    const missing = REQUIRED_COMPILER_EXPORTS.filter(
      (name) => !inspected.exports.some((entry) => entry.name === name),
    );
    if (missing.length !== 0) {
      throw new Error(`wasmc.wasm is missing exports: ${missing.join(", ")}`);
    }
    const instance = await WebAssembly.instantiate(inspected.module, {});
    return new WasmcBrowserCompiler(instance);
  }

  constructor(instance) {
    this.instance = instance;
  }

  compile(source) {
    this.#assertOpen();
    const api = this.instance.exports;
    const input = new TextEncoder().encode(source);
    const pointer = api.wasmc_alloc(input.length);
    new Uint8Array(api.memory.buffer, pointer, input.length).set(input);

    try {
      const status = api.wasmc_compile(pointer, input.length);
      if (status !== 0) {
        const message = copyText(
          api.memory,
          api.wasmc_error_ptr(),
          api.wasmc_error_len(),
        );
        const error = new Error(message || `wasmc_compile failed with status ${status}`);
        error.status = status;
        throw error;
      }
      return copyBytes(
        api.memory,
        api.wasmc_output_ptr(),
        api.wasmc_output_len(),
      );
    } finally {
      api.wasmc_clear();
    }
  }

  compilePackage(files) {
    return this.compile(flattenWasmcPackage(files));
  }

  async compileAndInstantiate(source, imports = {}) {
    const wasmBytes = this.compile(source);
    const inspected = inspectWasm(wasmBytes);
    const instance = await WebAssembly.instantiate(inspected.module, imports);
    return {
      wasmBytes,
      imports: inspected.imports,
      exports: inspected.exports,
      instance,
    };
  }

  dispose() {
    if (this.instance !== null) {
      this.instance.exports.wasmc_clear();
      this.instance = null;
    }
  }

  #assertOpen() {
    if (this.instance === null) {
      throw new Error("wasmc browser compiler has been disposed");
    }
  }
}

export async function loadWasmcBrowserCompiler(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch wasmc.wasm: HTTP ${response.status}`);
  }
  return WasmcBrowserCompiler.create(await response.arrayBuffer());
}


const DEFAULT_COMPILER_URL = new URL("./wasmc_compiler.wasm", import.meta.url);
export const FASTAPI_CORE_URL = new URL("./fastapi_core.wasm", import.meta.url);
export const FASTAPI_CORE_METADATA_URL = new URL("./fastapi_core.json", import.meta.url);
let defaultCompilerPromise = null;

async function readCompilerArtifact(url) {
  const resolved = url instanceof URL ? url : new URL(url, import.meta.url);
  if (resolved.protocol !== "file:") {
    const response = await fetch(resolved);
    if (!response.ok) {
      throw new Error(`failed to fetch compiler Wasm: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  if (typeof Deno !== "undefined") return await Deno.readFile(resolved);
  if (typeof Bun !== "undefined") {
    return new Uint8Array(await Bun.file(resolved).arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(await readFile(resolved));
}

async function defaultCompilerBytes(url) {
  return await readCompilerArtifact(url);
}

export async function loadFastApiCoreBytes(url = FASTAPI_CORE_URL) {
  return await readCompilerArtifact(url);
}

export async function createCompiler(options = {}) {
  const bytes =
    options.compilerWasmBytes ??
    (await defaultCompilerBytes(options.compilerWasmUrl ?? DEFAULT_COMPILER_URL));
  return await WasmcBrowserCompiler.create(bytes);
}

export async function compile(source, options = {}) {
  if (
    options.compilerWasmBytes !== undefined ||
    options.compilerWasmUrl !== undefined
  ) {
    const compiler = await createCompiler(options);
    try {
      return compiler.compile(source);
    } finally {
      compiler.dispose();
    }
  }
  defaultCompilerPromise ??= createCompiler();
  return (await defaultCompilerPromise).compile(source);
}

export async function compilePackage(files, options = {}) {
  if (
    options.compilerWasmBytes !== undefined ||
    options.compilerWasmUrl !== undefined
  ) {
    const compiler = await createCompiler(options);
    try {
      return compiler.compilePackage(files);
    } finally {
      compiler.dispose();
    }
  }
  defaultCompilerPromise ??= createCompiler();
  return (await defaultCompilerPromise).compilePackage(files);
}

async function automaticHost() {
  if (typeof Deno !== "undefined") {
    return {
      readText: (path) => Deno.readTextFile(path),
      writeBytes: (path, bytes) => Deno.writeFile(path, bytes),
      stderr: (message) => console.error(message),
    };
  }
  if (typeof Bun !== "undefined") {
    return {
      readText: (path) => Bun.file(path).text(),
      writeBytes: (path, bytes) => Bun.write(path, bytes),
      stderr: (message) => console.error(message),
    };
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    const fs = await import("node:fs/promises");
    return {
      readText: (path) => fs.readFile(path, "utf8"),
      writeBytes: (path, bytes) => fs.writeFile(path, bytes),
      stderr: (message) => console.error(message),
    };
  }
  throw new Error(
    "browser main(argv, host) requires explicit readText/writeBytes host functions",
  );
}

export async function main(argv, host = undefined) {
  const io = host ?? (await automaticHost());
  if (argv.length !== 2) {
    io.stderr("usage: wasmc-js <input.wasmc> <output.wasm>");
    return 2;
  }
  try {
    const source = await io.readText(argv[0]);
    const wasmBytes = await compile(source);
    await io.writeBytes(argv[1], wasmBytes);
    io.stderr(`wrote ${argv[1]} (${wasmBytes.byteLength} bytes)`);
    return 0;
  } catch (error) {
    io.stderr(`error: ${error?.message ?? error}`);
    return 1;
  }
}
