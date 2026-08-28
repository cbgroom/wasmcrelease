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

const DETAILED_COMPILER_EXPORTS = [
  "wasmc_trace",
  "wasmc_diagnostic_ptr",
  "wasmc_diagnostic_len",
  "wasmc_trace_ptr",
  "wasmc_trace_len",
];

const LIB_COMPILER_EXPORTS = [
  "wasmc_plan_alloc",
  "wasmc_compile_lib",
  "wasmc_compile_lib_auto",
];

function planBytes(plan) {
  if (plan instanceof Uint8Array) return plan;
  if (plan instanceof ArrayBuffer) return new Uint8Array(plan);
  if (typeof plan === "string") return new TextEncoder().encode(plan);
  if (plan !== null && typeof plan === "object") {
    return new TextEncoder().encode(JSON.stringify(plan));
  }
  throw new TypeError("lib plan must be JSON text, an object, or bytes");
}

function copyBytes(memory, pointer, length) {
  return new Uint8Array(memory.buffer, pointer, length).slice();
}

function copyText(memory, pointer, length) {
  return new TextDecoder().decode(copyBytes(memory, pointer, length));
}

function parseCompilerJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`wasmc compiler returned invalid ${label} JSON: ${error.message}`);
  }
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
    throw new TypeError("wasmc package source name must be a non-empty string");
  }
  if (name.includes("\0")) {
    throw new TypeError(`wasmc package source \`${name}\` must not contain NUL`);
  }
}

export function flattenWasmcPackage(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("wasmc package must contain at least one source file");
  }
  const ordered = files.map((file) => {
    if (file === null || typeof file !== "object") {
      throw new TypeError("wasmc package files must be { name, source } objects");
    }
    validatePackageSourceName(file.name);
    if (typeof file.source !== "string") {
      throw new TypeError(`wasmc package source \`${file.name}\` must be a string`);
    }
    return { name: file.name, source: file.source };
  }).sort((left, right) => compareUtf8(left.name, right.name));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1].name === ordered[index].name) {
      throw new TypeError(
        `duplicate wasmc package source \`${ordered[index].name}\``,
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
    const result = this.#compile(source, false);
    if (result.ok) return result.wasmBytes;
    const error = new Error(
      result.diagnostic?.message || `wasmc_compile failed with status ${result.status}`,
    );
    error.status = result.status;
    error.diagnostic = result.diagnostic;
    throw error;
  }

  compileDetailed(source) {
    return this.#compile(source, true);
  }

  compileLibApp(source, plan) {
    this.#assertOpen();
    const api = this.instance.exports;
    const missing = LIB_COMPILER_EXPORTS.filter(
      (name) => typeof api[name] !== "function",
    );
    if (missing.length !== 0) {
      throw new Error(
        `wasmc compiler does not support lib compilation: missing ${missing.join(", ")}`,
      );
    }
    const sourceInput = new TextEncoder().encode(source);
    const sourcePointer = api.wasmc_alloc(sourceInput.length);
    new Uint8Array(api.memory.buffer, sourcePointer, sourceInput.length).set(sourceInput);
    try {
      let status;
      if (plan === undefined) {
        status = api.wasmc_compile_lib_auto(sourcePointer, sourceInput.length);
      } else {
        const planInput = planBytes(plan);
        const planPointer = api.wasmc_plan_alloc(planInput.length);
        new Uint8Array(api.memory.buffer, planPointer, planInput.length).set(planInput);
        status = api.wasmc_compile_lib(
          sourcePointer,
          sourceInput.length,
          planPointer,
          planInput.length,
        );
      }
      if (status !== 0) {
        const message = copyText(
          api.memory,
          api.wasmc_error_ptr(),
          api.wasmc_error_len(),
        );
        const diagnosticText = copyText(
          api.memory,
          api.wasmc_diagnostic_ptr(),
          api.wasmc_diagnostic_len(),
        );
        const error = new Error(message || `lib compilation failed with status ${status}`);
        error.status = status;
        error.diagnostic = diagnosticText
          ? parseCompilerJson(diagnosticText, "diagnostic")
          : undefined;
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

  #compile(source, includeTrace) {
    this.#assertOpen();
    const api = this.instance.exports;
    if (includeTrace) {
      const missing = DETAILED_COMPILER_EXPORTS.filter(
        (name) => typeof api[name] !== "function",
      );
      if (missing.length !== 0) {
        throw new Error(
          `wasmc compiler does not support compileDetailed: missing ${missing.join(", ")}`,
        );
      }
    }
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
        const diagnosticText =
          typeof api.wasmc_diagnostic_ptr === "function"
            ? copyText(
                api.memory,
                api.wasmc_diagnostic_ptr(),
                api.wasmc_diagnostic_len(),
              )
            : "";
        const diagnostic = diagnosticText
          ? parseCompilerJson(diagnosticText, "diagnostic")
          : { category: "compile.other", kind: "parse", message };
        return { ok: false, status, diagnostic };
      }
      const wasmBytes = copyBytes(
        api.memory,
        api.wasmc_output_ptr(),
        api.wasmc_output_len(),
      );
      if (!includeTrace) return { ok: true, status: 0, wasmBytes };
      const traceStatus = api.wasmc_trace(pointer, input.length);
      if (traceStatus !== 0) {
        const diagnosticText = copyText(
          api.memory,
          api.wasmc_diagnostic_ptr(),
          api.wasmc_diagnostic_len(),
        );
        return {
          ok: false,
          status: traceStatus,
          diagnostic: diagnosticText
            ? parseCompilerJson(diagnosticText, "diagnostic")
            : { category: "trace.other", kind: "parse", message: "ABI trace failed" },
        };
      }
      const trace = parseCompilerJson(
        copyText(api.memory, api.wasmc_trace_ptr(), api.wasmc_trace_len()),
        "trace",
      );
      if (trace.schema_version !== 1 || typeof trace.consistent !== "boolean") {
        throw new Error("wasmc compiler returned an unsupported trace schema");
      }
      return {
        ok: true,
        status: 0,
        wasmBytes,
        trace,
      };
    } finally {
      api.wasmc_clear();
    }
  }

  compilePackage(files) {
    return this.compile(flattenWasmcPackage(files));
  }

  compilePackageDetailed(files) {
    return this.compileDetailed(flattenWasmcPackage(files));
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
const DEFAULT_LIB_URL = new URL("./lib_core.wasm", import.meta.url);
const LIB_IMPORT_MODULE = "wasmc:lib/wasmc.lib_managed_object_heap@4.3.0";
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

async function defaultLibBytes(url) {
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

export async function compileDetailed(source, options = {}) {
  if (
    options.compilerWasmBytes !== undefined ||
    options.compilerWasmUrl !== undefined
  ) {
    const compiler = await createCompiler(options);
    try {
      return compiler.compileDetailed(source);
    } finally {
      compiler.dispose();
    }
  }
  defaultCompilerPromise ??= createCompiler();
  return (await defaultCompilerPromise).compileDetailed(source);
}

function normalizeLibArguments(planOrOptions, maybeOptions) {
  if (maybeOptions !== undefined) return [planOrOptions, maybeOptions];
  if (planOrOptions === undefined) return [undefined, {}];
  if (
    planOrOptions !== null &&
    typeof planOrOptions === "object" &&
    !(planOrOptions instanceof Uint8Array) &&
    !(planOrOptions instanceof ArrayBuffer)
  ) {
    return [planOrOptions.plan, planOrOptions];
  }
  return [planOrOptions, {}];
}

export async function compileLib(source, planOrOptions, maybeOptions) {
  const [plan, options] = normalizeLibArguments(planOrOptions, maybeOptions);
  let appWasm;
  if (
    options.compilerWasmBytes !== undefined ||
    options.compilerWasmUrl !== undefined
  ) {
    const compiler = await createCompiler(options);
    try {
      appWasm = compiler.compileLibApp(source, plan);
    } finally {
      compiler.dispose();
    }
  } else {
    defaultCompilerPromise ??= createCompiler();
    appWasm = (await defaultCompilerPromise).compileLibApp(source, plan);
  }
  const libWasm =
    options.libWasmBytes ??
    (await defaultLibBytes(
      options.libWasmUrl ?? DEFAULT_LIB_URL,
    ));
  return Object.freeze({
    appWasm,
    libWasm,
  });
}

function nextLibStoreNonce() {
  const nonce = nextLibStoreNonce.value ?? 1;
  if (nonce > 0x00ff_ffff) {
    throw new Error("lib Store nonce space exhausted for this facade instance");
  }
  nextLibStoreNonce.value = nonce + 1;
  return nonce;
}

async function verifyLib(libWasm) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", libWasm));
  const digestHex = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  if (digestHex !== "86670b35fe4ff01f9ad4392b42ce8816e4679f680ab788599905edb1bbe6e749") {
    throw new Error("wasmc lib artifact identity mismatch");
  }
  const module = new WebAssembly.Module(libWasm);
  if (WebAssembly.Module.imports(module).length !== 0) {
    throw new Error("wasmc lib must be import-free");
  }
  return module;
}

export async function instantiateLib(source, planOrOptions, maybeOptions) {
  const [plan, options] = normalizeLibArguments(planOrOptions, maybeOptions);
  const bundle = await compileLib(source, plan, options);
  const libModule = await verifyLib(bundle.libWasm);
  const appModule = new WebAssembly.Module(bundle.appWasm);
  const lib = await WebAssembly.instantiate(libModule, {});
  const libInit = lib.exports.provider_domain_init;
  if (typeof libInit !== "function") {
    throw new Error("wasmc lib initialization export is missing");
  }
  if (libInit(52, nextLibStoreNonce()) !== 0) {
    throw new Error("wasmc lib initialization failed");
  }

  const supplied = options.imports ?? {};
  if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) {
    throw new TypeError("lib imports must be an object");
  }
  if (Object.hasOwn(supplied, LIB_IMPORT_MODULE)) {
    throw new Error("lib-owned imports are private");
  }
  const imports = Object.create(null);
  const used = new Set();
  for (const entry of WebAssembly.Module.imports(appModule)) {
    if (entry.kind !== "function") {
      throw new Error(`unsupported application import kind: ${entry.module}.${entry.name}`);
    }
    imports[entry.module] ??= Object.create(null);
    if (entry.module === LIB_IMPORT_MODULE) {
      const binding = lib.exports[entry.name];
      if (typeof binding !== "function") {
        throw new Error(`wasmc lib binding is missing: ${entry.name}`);
      }
      imports[entry.module][entry.name] = binding;
      continue;
    }
    const bindings = Object.hasOwn(supplied, entry.module) ? supplied[entry.module] : null;
    const binding = bindings && Object.hasOwn(bindings, entry.name) ? bindings[entry.name] : null;
    if (typeof binding !== "function") {
      throw new TypeError(`missing lib Host function: ${entry.module}.${entry.name}`);
    }
    imports[entry.module][entry.name] = binding;
    used.add(`${entry.module}\0${entry.name}`);
  }
  for (const [module, bindings] of Object.entries(supplied)) {
    if (bindings === null || typeof bindings !== "object" || Array.isArray(bindings)) {
      throw new TypeError(`lib Host module must be an object: ${module}`);
    }
    if (Object.keys(bindings).length === 0) throw new Error(`extra lib Host module: ${module}`);
    for (const name of Object.keys(bindings)) {
      if (!used.has(`${module}\0${name}`)) {
        throw new Error(`extra lib Host import: ${module}.${name}`);
      }
    }
  }

  const application = await WebAssembly.instantiate(appModule, imports);
  const managedInit = application.exports.__wasmc_managed_init;
  if (typeof managedInit !== "function" || managedInit() !== 0) {
    throw new Error("managed application initialization failed");
  }
  return application;
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

export async function compilePackageDetailed(files, options = {}) {
  if (
    options.compilerWasmBytes !== undefined ||
    options.compilerWasmUrl !== undefined
  ) {
    const compiler = await createCompiler(options);
    try {
      return compiler.compilePackageDetailed(files);
    } finally {
      compiler.dispose();
    }
  }
  defaultCompilerPromise ??= createCompiler();
  return (await defaultCompilerPromise).compilePackageDetailed(files);
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
