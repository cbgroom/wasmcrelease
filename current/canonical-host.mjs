// Generic SDK marshalling for the compiler's Canonical Host modules protocol.
// The embedding application owns exact Host contracts, Lib selection and sealing.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const sha = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
const hex = bytes => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
const copy = (value, label) => {
  if (!(value instanceof Uint8Array) || value.length === 0) {
    throw new TypeError(label + ' must be nonempty Uint8Array bytes');
  }
  return value.slice();
};
const tuple = (value, label) => ['wit', 'executionAbi', 'providerContract', 'binding']
  .map(key => copy(value?.[key], label + '.' + key));
async function digestTuple(values) {
  const out = new Uint8Array(128);
  for (let i = 0; i < values.length; i++) out.set(await sha(values[i]), 32 * i);
  return out;
}
function window(api, pointer, length) {
  pointer = Number(pointer) >>> 0;
  length = Number(length) >>> 0;
  if (pointer > api.memory.buffer.byteLength || length > api.memory.buffer.byteLength - pointer) {
    throw new Error('Compiler returned an invalid memory window');
  }
  return new Uint8Array(api.memory.buffer, pointer, length).slice();
}
function write(api, allocate, bytes) {
  const pointer = Number(allocate(bytes.length)) >>> 0;
  if (!pointer || bytes.length > api.memory.buffer.byteLength - pointer) {
    throw new Error('Compiler input allocation failed');
  }
  new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
}
export async function decodeCanonicalHostFrame(frameBytes) {
  const frame = copy(frameBytes, 'frame');
  if (frame.length < 12 || decoder.decode(frame.subarray(0, 8)) !== 'WASMCB01') {
    throw new Error('Unsupported Canonical Host frame');
  }
  const length = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(8, true);
  if (length > 1024 * 1024 || length > frame.length - 12) throw new Error('Invalid frame descriptor length');
  const descriptor = JSON.parse(decoder.decode(frame.subarray(12, 12 + length)));
  if (descriptor.schema !== 'wasmc.canonical-host-modules/v1' || !Array.isArray(descriptor.modules)) {
    throw new Error('Unsupported Canonical Host descriptor');
  }
  const payload = frame.subarray(12 + length);
  const modules = new Map();
  let end = 0;
  for (const row of descriptor.modules) {
    if (typeof row.path !== 'string' || modules.has(row.path) ||
        !Number.isSafeInteger(row.offset) || row.offset !== end ||
        !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > payload.length - end) {
      throw new Error('Invalid Canonical Host module window');
    }
    const bytes = payload.slice(end, end + row.bytes);
    if (hex(await sha(bytes)) !== row.sha256) throw new Error('Canonical Host module digest differs: ' + row.path);
    await WebAssembly.compile(bytes);
    modules.set(row.path, bytes);
    end += row.bytes;
  }
  if (end !== payload.length) throw new Error('Unexpected Canonical Host frame tail');
  return {frame, descriptor, modules};
}
export async function createCanonicalHostCompiler(compilerBytes) {
  const bytes = copy(compilerBytes, 'compiler');
  if (bytes.length > 2097152) throw new Error('Compiler exceeds the public 2 MiB artifact budget');
  const module = await WebAssembly.compile(bytes);
  if (WebAssembly.Module.imports(module).length !== 0) throw new Error('Compiler must be import-free');
  const api = new WebAssembly.Instance(module, {}).exports;
  for (const name of ['wasmc_alloc', 'wasmc_wit_fastabi_artifact_alloc', 'wasmc_compile_wit_fastabi',
    'wasmc_output_ptr', 'wasmc_output_len', 'wasmc_error_ptr', 'wasmc_error_len', 'wasmc_clear',
    'wasmc_canonical_host_protocol_version']) {
    if (typeof api[name] !== 'function') throw new Error('Compiler export missing: ' + name);
  }
  if (!(api.memory instanceof WebAssembly.Memory) || api.wasmc_canonical_host_protocol_version() !== 1) {
    throw new Error('Unsupported Canonical Host compiler protocol');
  }
  let busy = false;
  let disposed = false;
  return {
    async compile({source, activation, entry, operations, libCore, libWit, template}) {
      if (disposed) throw new Error('Compiler has been disposed');
      if (busy) throw new Error('Compiler is already compiling');
      busy = true;
      api.wasmc_clear();
      try {
        if (typeof source !== 'string') throw new TypeError('source must be a string');
        const input = encoder.encode(source);
        if (!input.length || input.length > 1024 * 1024) throw new Error('Source exceeds the hosted byte budget');
        const e = tuple(entry, 'entry'), o = tuple(operations, 'operations');
        const extension = [copy(activation, 'activation'), copy(libCore, 'libCore'),
          copy(libWit, 'libWit'), copy(template, 'template'), ...o, await digestTuple(o)];
        // Full engine type validation complements the hosted frontend's structural decoder.
        await WebAssembly.compile(extension[1]);
        const parts = [...e, await digestTuple(e), ...extension];
        for (let kind = 0; kind < parts.length; kind++) {
          write(api, length => api.wasmc_wit_fastabi_artifact_alloc(kind, length), parts[kind]);
        }
        const pointer = write(api, length => api.wasmc_alloc(length), input);
        const status = api.wasmc_compile_wit_fastabi(pointer, input.length);
        if (status !== 0) {
          const message = decoder.decode(window(api, api.wasmc_error_ptr(), api.wasmc_error_len()));
          const error = new Error(message || 'Canonical Host compilation failed');
          error.status = status;
          throw error;
        }
        const frame = window(api, api.wasmc_output_ptr(), api.wasmc_output_len());
        return await decodeCanonicalHostFrame(frame);
      } finally {
        api.wasmc_clear();
        busy = false;
      }
    },
    dispose() {
      if (busy) throw new Error('Compiler is already compiling');
      api.wasmc_clear();
      disposed = true;
    }
  };
}
