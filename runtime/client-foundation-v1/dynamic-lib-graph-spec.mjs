import { createHash } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/;
const NODE_ID = /^[a-z][a-z0-9-]{0,63}$/;

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function canonicalJson(value) {
  const visiting = new Set();
  const encode = (entry) => {
    if (entry === null || typeof entry === "boolean" || typeof entry === "string") return JSON.stringify(entry);
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) throw new Error("dynamic Lib configuration contains a non-finite number");
      return JSON.stringify(Object.is(entry, -0) ? 0 : entry);
    }
    if (Array.isArray(entry)) {
      if (visiting.has(entry)) throw new Error("dynamic Lib configuration contains a cycle");
      visiting.add(entry);
      const items = [];
      for (let index = 0; index < entry.length; index += 1) {
        if (!Object.hasOwn(entry, index)) throw new Error("dynamic Lib configuration contains a sparse array");
        items.push(encode(entry[index]));
      }
      const encoded = `[${items.join(",")}]`;
      visiting.delete(entry);
      return encoded;
    }
    if (typeof entry === "object") {
      if (visiting.has(entry)) throw new Error("dynamic Lib configuration contains a cycle");
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("dynamic Lib configuration must contain only JSON objects");
      visiting.add(entry);
      const encoded = `{${Object.keys(entry).sort().map((key) => {
        if (entry[key] === undefined || typeof entry[key] === "function" || typeof entry[key] === "symbol" || typeof entry[key] === "bigint") {
          throw new Error("dynamic Lib configuration contains a non-JSON value");
        }
        return `${JSON.stringify(key)}:${encode(entry[key])}`;
      }).join(",")}}`;
      visiting.delete(entry);
      return encoded;
    }
    throw new Error("dynamic Lib configuration contains a non-JSON value");
  };
  return encode(value);
}

export const canonicalJsonSha256 = (value) => digest(Buffer.from(canonicalJson(value)));

export function describeSerialLibGraph({ blocks, pipeline }) {
  if (!Array.isArray(blocks) || !Array.isArray(pipeline) || blocks.length === 0 || pipeline.length === 0) {
    throw new Error("incomplete dynamic Lib graph");
  }
  const declarations = new Map();
  for (const block of blocks) {
    if (!block || !NODE_ID.test(block.name) || declarations.has(block.name) || typeof block.root !== "string" || typeof block.identity !== "string" || block.identity.length === 0) {
      throw new Error("invalid dynamic Lib block declaration");
    }
    for (const [field, value] of [["artifact", block.artifact_sha256], ["configuration", block.configuration_sha256], ["WIT contract", block.wit_contract_sha256]]) {
      if (!SHA256.test(value)) throw new Error(`invalid dynamic Lib ${field} identity: ${block.name}`);
    }
    if (block.state_policy !== "stateless" || block.state_schema_identity !== null) {
      throw new Error(`unsupported dynamic Lib state policy: ${block.name}`);
    }
    const computedConfiguration = canonicalJsonSha256(block.configuration);
    if (computedConfiguration !== block.configuration_sha256) throw new Error(`dynamic Lib configuration identity mismatch: ${block.name}`);
    declarations.set(block.name, block);
  }
  if (pipeline.length !== declarations.size || new Set(pipeline).size !== pipeline.length || pipeline.some((name) => !declarations.has(name))) {
    throw new Error("dynamic Lib serial pipeline must contain every block exactly once");
  }

  const edges = [];
  for (let index = 0; index + 1 < pipeline.length; index += 1) {
    const from = declarations.get(pipeline[index]);
    const to = declarations.get(pipeline[index + 1]);
    if (from.wit_contract_sha256 !== to.wit_contract_sha256) {
      throw new Error(`dynamic Lib WIT port contract mismatch: ${from.name}->${to.name}`);
    }
    edges.push({
      from: { node: from.name, port: "result" },
      to: { node: to.name, port: "payload" },
      wit_contract_sha256: from.wit_contract_sha256,
    });
  }

  const first = declarations.get(pipeline[0]);
  const last = declarations.get(pipeline[pipeline.length - 1]);
  const spec = {
    schema: "wasmc.dynamic-lib-graph-spec/v1",
    shape: "serial-dag",
    nodes: [...declarations.values()].map((block) => ({
      node_id: block.name,
      lib_identity: block.identity,
      package_sha256: block.artifact_sha256,
      configuration_sha256: block.configuration_sha256,
      state_policy: block.state_policy,
      state_schema_identity: block.state_schema_identity,
      input_wit_contract_sha256: block.wit_contract_sha256,
      output_wit_contract_sha256: block.wit_contract_sha256,
    })).sort((left, right) => left.node_id.localeCompare(right.node_id)),
    edges,
    entrypoints: {
      invoke: {
        input: { node: first.name, port: "payload", wit_contract_sha256: first.wit_contract_sha256 },
        output: { node: last.name, port: "result", wit_contract_sha256: last.wit_contract_sha256 },
      },
    },
    policy: { execution: "serial", failure: "fail-fast" },
  };
  return { spec, graph_digest: canonicalJsonSha256(spec) };
}
