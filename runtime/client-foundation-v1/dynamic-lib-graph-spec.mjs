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

export function identifyDynamicLibPackageFiles(entries) {
  const files = new Map(entries.map(({ path, bytes }) => [path, Buffer.from(bytes)]));
  if (files.size !== entries.length) throw new Error("duplicate dynamic Lib package file");
  const descriptorBytes = files.get("native-boundary.json");
  if (!descriptorBytes) throw new Error("missing dynamic Lib descriptor");
  const descriptor = JSON.parse(descriptorBytes.toString("utf8"));
  if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1" || typeof descriptor.identity !== "string" || descriptor.identity.length === 0) {
    throw new Error("invalid dynamic Lib descriptor identity");
  }
  if (typeof descriptor.wit !== "string" || typeof descriptor.adapter?.path !== "string") {
    throw new Error("incomplete dynamic Lib package identity");
  }
  if (descriptor.graph_ports !== undefined && typeof descriptor.graph_ports !== "string") {
    throw new Error("invalid dynamic Lib WIT port manifest path");
  }
  const selected = ["native-boundary.json", descriptor.wit, descriptor.adapter.path, ...(descriptor.graph_ports ? [descriptor.graph_ports] : [])];
  if (new Set(selected).size !== selected.length || selected.some((name) => !files.has(name))) {
    throw new Error("incomplete dynamic Lib package files");
  }
  const packageDigest = createHash("sha256");
  for (const name of selected.sort()) {
    const bytes = files.get(name);
    packageDigest.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`);
    packageDigest.update(bytes);
  }
  return {
    identity: descriptor.identity,
    artifact_sha256: packageDigest.digest("hex"),
    wit_contract_sha256: digest(files.get(descriptor.wit)),
    graph_ports: descriptor.graph_ports ? JSON.parse(files.get(descriptor.graph_ports).toString("utf8")) : null,
    descriptor,
  };
}

const assertPortMap = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid dynamic Lib ${label} ports`);
  for (const [name, identity] of Object.entries(value)) {
    if (!NODE_ID.test(name) || !SHA256.test(identity)) throw new Error(`invalid dynamic Lib ${label} port contract`);
  }
};

export function describeDynamicLibDag({ blocks, edges, entrypoint }) {
  if (!Array.isArray(blocks) || blocks.length === 0 || !Array.isArray(edges) || !entrypoint) throw new Error("incomplete dynamic Lib DAG");
  const declarations = new Map();
  for (const block of blocks) {
    if (!block || !NODE_ID.test(block.name) || declarations.has(block.name) || typeof block.root !== "string" || typeof block.identity !== "string" || block.identity.length === 0) {
      throw new Error("invalid dynamic Lib block declaration");
    }
    for (const [field, value] of [["artifact", block.artifact_sha256], ["configuration", block.configuration_sha256], ["WIT contract", block.wit_contract_sha256], ["port contract set", block.port_contracts_sha256]]) {
      if (!SHA256.test(value)) throw new Error(`invalid dynamic Lib ${field} identity: ${block.name}`);
    }
    if (block.state_policy !== "stateless" || block.state_schema_identity !== null) throw new Error(`unsupported dynamic Lib state policy: ${block.name}`);
    if (canonicalJsonSha256(block.configuration) !== block.configuration_sha256) throw new Error(`dynamic Lib configuration identity mismatch: ${block.name}`);
    assertPortMap(block.port_contracts?.inputs, "input");
    assertPortMap(block.port_contracts?.outputs, "output");
    if (canonicalJsonSha256(block.port_contracts) !== block.port_contracts_sha256) throw new Error(`dynamic Lib port contract identity mismatch: ${block.name}`);
    declarations.set(block.name, block);
  }
  const inputKey = ({ node, port }) => `${node}:${port}`;
  const incoming = new Map();
  const outgoing = new Map([...declarations.keys()].map((name) => [name, []]));
  const indegree = new Map([...declarations.keys()].map((name) => [name, 0]));
  const normalizedEdges = edges.map((edge) => {
    const from = declarations.get(edge?.from?.node);
    const to = declarations.get(edge?.to?.node);
    const fromContract = from?.port_contracts.outputs?.[edge?.from?.port];
    const toContract = to?.port_contracts.inputs?.[edge?.to?.port];
    if (!from || !to || !fromContract || !toContract) throw new Error("dynamic Lib DAG edge references an unknown node or port");
    if (fromContract !== toContract) throw new Error(`dynamic Lib WIT port contract mismatch: ${from.name}.${edge.from.port}->${to.name}.${edge.to.port}`);
    const key = inputKey(edge.to);
    if (incoming.has(key)) throw new Error(`dynamic Lib DAG input has multiple producers: ${key}`);
    incoming.set(key, edge.from);
    outgoing.get(from.name).push(to.name);
    indegree.set(to.name, indegree.get(to.name) + 1);
    return { from: { node: from.name, port: edge.from.port }, to: { node: to.name, port: edge.to.port }, wit_contract_sha256: fromContract };
  });
  const inputNode = declarations.get(entrypoint.input?.node);
  const outputNode = declarations.get(entrypoint.output?.node);
  const inputContract = inputNode?.port_contracts.inputs?.[entrypoint.input?.port];
  const outputContract = outputNode?.port_contracts.outputs?.[entrypoint.output?.port];
  if (!inputContract || !outputContract) throw new Error("dynamic Lib DAG entrypoint references an unknown node or port");
  const entryKey = inputKey(entrypoint.input);
  if (incoming.has(entryKey)) throw new Error("dynamic Lib DAG entrypoint input also has an edge producer");
  incoming.set(entryKey, { entrypoint: "invoke" });
  for (const [name, block] of declarations) {
    for (const port of Object.keys(block.port_contracts.inputs)) {
      if (!incoming.has(`${name}:${port}`)) throw new Error(`dynamic Lib DAG input has no producer: ${name}:${port}`);
    }
  }
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([name]) => name).sort();
  const order = [];
  const levels = [];
  while (queue.length > 0) {
    const level = queue.splice(0).sort();
    levels.push(level);
    for (const name of level) {
      order.push(name);
      for (const target of outgoing.get(name)) {
        indegree.set(target, indegree.get(target) - 1);
        if (indegree.get(target) === 0) queue.push(target);
      }
    }
  }
  if (order.length !== declarations.size) throw new Error("dynamic Lib DAG contains a cycle");
  const reachable = new Set([inputNode.name]);
  for (const name of order) if (reachable.has(name)) for (const target of outgoing.get(name)) reachable.add(target);
  if (reachable.size !== declarations.size || !reachable.has(outputNode.name)) throw new Error("dynamic Lib DAG contains a disconnected node");
  const reverse = new Map([...declarations.keys()].map((name) => [name, []]));
  for (const edge of normalizedEdges) reverse.get(edge.to.node).push(edge.from.node);
  const contributing = new Set([outputNode.name]);
  for (const name of [...order].reverse()) if (contributing.has(name)) for (const source of reverse.get(name)) contributing.add(source);
  if (contributing.size !== declarations.size) throw new Error("dynamic Lib DAG contains a node that does not contribute to output");

  const spec = {
    schema: "wasmc.dynamic-lib-graph-spec/v1",
    shape: "general-dag",
    nodes: [...declarations.values()].map((block) => ({
      node_id: block.name, lib_identity: block.identity, package_sha256: block.artifact_sha256,
      configuration_sha256: block.configuration_sha256, state_policy: block.state_policy,
      state_schema_identity: block.state_schema_identity, wit_contract_sha256: block.wit_contract_sha256,
      port_contracts_sha256: block.port_contracts_sha256,
    })).sort((left, right) => left.node_id.localeCompare(right.node_id)),
    edges: normalizedEdges.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
    entrypoints: { invoke: { input: { ...entrypoint.input, wit_contract_sha256: inputContract }, output: { ...entrypoint.output, wit_contract_sha256: outputContract } } },
    policy: { execution: "topological-level-parallel", failure: "fail-fast" },
  };
  return { spec, graph_digest: canonicalJsonSha256(spec), order, levels };
}

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
