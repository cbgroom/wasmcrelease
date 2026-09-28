import { createHash } from "node:crypto";
import { canonicalJson, canonicalJsonSha256 } from "./dynamic-lib-graph-spec.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const PRIMITIVES = new Set(["bool", "u8", "u16", "u32", "u64", "s8", "s16", "s32", "s64", "f32", "f64", "char", "string", "error-context"]);

function resolveType(types, type, visiting = new Set()) {
  if (typeof type === "string") {
    if (!PRIMITIVES.has(type)) throw new Error(`unknown wasm-tools WIT primitive: ${type}`);
    return { primitive: type };
  }
  if (!Number.isSafeInteger(type) || type < 0 || type >= types.length) throw new Error("invalid wasm-tools WIT type reference");
  if (visiting.has(type)) return { recursive: types[type].name ?? "$anonymous" };
  visiting.add(type);
  const entry = types[type];
  const map = (value) => resolveType(types, value, new Set(visiting));
  const transform = (value) => {
    if (typeof value === "number" || (typeof value === "string" && PRIMITIVES.has(value))) return map(value);
    if (typeof value === "string") return value;
    if (value === null || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.map(transform);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, transform(nested)]));
    throw new Error("unsupported wasm-tools WIT type shape");
  };
  return { name: entry.name ?? null, kind: transform(entry.kind) };
}

export function deriveWitPortContracts(witDocument, { world, interface: interfaceName, function: functionName = "invoke", wit_sha256 }) {
  if (!witDocument || !Array.isArray(witDocument.worlds) || !Array.isArray(witDocument.interfaces) || !Array.isArray(witDocument.types)) {
    throw new Error("invalid wasm-tools WIT JSON document");
  }
  const selectedWorld = witDocument.worlds.find((entry) => entry.name === world);
  if (!selectedWorld) throw new Error(`WIT world not found: ${world}`);
  const selectedInterface = witDocument.interfaces.find((entry) => entry.name === interfaceName && entry.package === selectedWorld.package);
  if (!selectedInterface) throw new Error(`WIT interface not found: ${interfaceName}`);
  const selectedFunction = selectedInterface.functions?.[functionName];
  if (!selectedFunction) throw new Error(`WIT function not found: ${functionName}`);
  const contract = (type) => canonicalJsonSha256({ schema: "wasmc.wit-port-type/v1", type: resolveType(witDocument.types, type) });
  const inputs = Object.fromEntries(selectedFunction.params.map(({ name, type }) => [name, contract(type)]));
  const outputs = selectedFunction.result === null || selectedFunction.result === undefined ? {} : { result: contract(selectedFunction.result) };
  const manifest = {
    schema: "wasmc.wit-port-contracts/v1",
    source: { world, interface: interfaceName, function: functionName, wit_sha256 },
    inputs,
    outputs,
  };
  return { ...manifest, contract_set_sha256: digest(Buffer.from(canonicalJson(manifest))) };
}

export function validateWitPortManifest(manifest, witBytes) {
  if (manifest?.schema !== "wasmc.wit-port-contracts/v1" || typeof manifest.source?.wit_sha256 !== "string") {
    throw new Error("invalid dynamic Lib WIT port manifest");
  }
  if (digest(witBytes) !== manifest.source.wit_sha256) throw new Error("dynamic Lib WIT port manifest source mismatch");
  const unsigned = { schema: manifest.schema, source: manifest.source, inputs: manifest.inputs, outputs: manifest.outputs };
  if (canonicalJsonSha256(unsigned) !== manifest.contract_set_sha256) throw new Error("dynamic Lib WIT port manifest identity mismatch");
  for (const direction of ["inputs", "outputs"]) {
    if (!manifest[direction] || typeof manifest[direction] !== "object" || Array.isArray(manifest[direction])) throw new Error(`invalid dynamic Lib WIT ${direction}`);
    for (const [name, identity] of Object.entries(manifest[direction])) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(name) || !/^[a-f0-9]{64}$/.test(identity)) throw new Error(`invalid dynamic Lib WIT ${direction} contract`);
    }
  }
  return manifest;
}
