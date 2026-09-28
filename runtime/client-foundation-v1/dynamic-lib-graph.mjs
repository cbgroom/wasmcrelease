import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, canonicalJsonSha256, describeDynamicLibDag, describeSerialLibGraph, identifyDynamicLibPackageFiles } from "./dynamic-lib-graph-spec.mjs";
import { validateWitPortManifest } from "./wit-port-contracts.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

export async function inspectDynamicLibPackage(packageRoot) {
  const root = await realpath(packageRoot);
  const descriptorPath = path.join(root, "native-boundary.json");
  const descriptorBytes = await readFile(descriptorPath);
  const descriptor = JSON.parse(descriptorBytes);
  if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1" || typeof descriptor.identity !== "string" || descriptor.identity.length === 0) {
    throw new Error("invalid dynamic Lib descriptor identity");
  }
  if (typeof descriptor.wit !== "string" || typeof descriptor.adapter?.path !== "string") {
    throw new Error("incomplete dynamic Lib package identity");
  }
  const witPath = await realpath(path.resolve(root, descriptor.wit));
  const witBytes = await readFile(witPath);
  const files = [
    ["native-boundary.json", descriptorPath, descriptorBytes],
    [descriptor.wit, witPath, witBytes],
    [descriptor.adapter.path, await realpath(path.resolve(root, descriptor.adapter.path))],
    ...(descriptor.graph_ports ? [[descriptor.graph_ports, await realpath(path.resolve(root, descriptor.graph_ports))]] : []),
  ];
  if (files.some(([, file]) => !within(root, file))) throw new Error("dynamic Lib package file escapes exact root");
  const exact = identifyDynamicLibPackageFiles(await Promise.all(files.map(async ([name, file, knownBytes]) => ({ path: name, bytes: knownBytes ?? await readFile(file) }))));
  if (exact.graph_ports) validateWitPortManifest(exact.graph_ports, witBytes);
  return exact;
}

export class DynamicLibGraph {
  constructor({ boundary, initialRevision = 0 }) {
    if (!boundary) throw new Error("DynamicLibGraph requires the fixed Host boundary");
    if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) throw new Error("invalid dynamic Lib graph initial revision");
    this.boundary = boundary;
    this.active = { revision: initialRevision, graphDigest: null, blocks: new Map(), shape: "serial-dag", pipeline: [], edges: [], entrypoint: null, levels: [], inflight: 0, drainWaiters: [] };
    this.retired = new Set();
    this.closed = false;
    this.updateInProgress = false;
  }

  snapshot() {
    return {
      revision: this.active.revision,
      graph_digest: this.active.graphDigest,
      pipeline: [...this.active.pipeline],
      shape: this.active.shape,
      edges: structuredClone(this.active.edges),
      entrypoint: structuredClone(this.active.entrypoint),
      retired: [...this.retired].map(({ generation }) => ({ revision: generation.revision, graph_digest: generation.graphDigest, inflight: generation.inflight })),
      blocks: Object.fromEntries([...this.active.blocks].map(([name, block]) => [name, {
        identity: block.identity,
        artifact_sha256: block.artifactSha,
        configuration_sha256: block.configurationSha,
        wit_contract_sha256: block.witContractSha,
        state_policy: block.statePolicy,
        state_schema_identity: block.stateSchemaIdentity,
        port_contracts_sha256: block.portContractsSha ?? null,
      }])),
    };
  }

  async apply({ expected_revision, graph_digest, blocks, pipeline, edges, entrypoint, onPublished, onRetired }) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.updateInProgress) throw new Error("dynamic Lib graph update already in progress");
    if (this.retired.size > 0) throw new Error("dynamic Lib graph retired cleanup pending");
    if (expected_revision !== this.active.revision) throw new Error("dynamic Lib graph revision fence mismatch");
    const dag = Array.isArray(edges) || entrypoint !== undefined;
    const described = dag ? describeDynamicLibDag({ blocks, edges, entrypoint }) : describeSerialLibGraph({ blocks, pipeline });
    if (graph_digest !== described.graph_digest) throw new Error("dynamic Lib graph digest mismatch");
    const desired = new Map(blocks.map((block) => [block.name, block]));
    if (graph_digest === this.active.graphDigest) {
      return { outcome: "unchanged", revision: this.active.revision, graph_digest, installed: 0, reused: desired.size, released: 0, pipeline: pipeline ? [...pipeline] : [], shape: dag ? "general-dag" : "serial-dag" };
    }

    const old = this.active;
    const candidateBlocks = new Map();
    const installed = [];
    let reused = 0;
    let published = false;
    this.updateInProgress = true;
    try {
      for (const [name, declaration] of desired) {
        const current = old.blocks.get(name);
        if (current?.artifactSha === declaration.artifact_sha256 && current.configurationSha === declaration.configuration_sha256) {
          if (current.identity !== declaration.identity || current.witContractSha !== declaration.wit_contract_sha256 || current.statePolicy !== declaration.state_policy || current.stateSchemaIdentity !== declaration.state_schema_identity || (dag && current.portContractsSha !== declaration.port_contracts_sha256)) {
            throw new Error(`dynamic Lib identity conflicts with retained instance: ${name}`);
          }
          candidateBlocks.set(name, current);
          reused += 1;
          continue;
        }
        const exact = await inspectDynamicLibPackage(declaration.root);
        if (exact.identity !== declaration.identity) throw new Error(`dynamic Lib descriptor identity mismatch: ${name}`);
        if (exact.artifact_sha256 !== declaration.artifact_sha256) throw new Error(`dynamic Lib package identity mismatch: ${name}`);
        if (exact.wit_contract_sha256 !== declaration.wit_contract_sha256) throw new Error(`dynamic Lib WIT contract identity mismatch: ${name}`);
        const exactPorts = exact.graph_ports ? { inputs: exact.graph_ports.inputs, outputs: exact.graph_ports.outputs } : null;
        if (dag) {
          if (!exactPorts) throw new Error(`dynamic Lib package has no WIT port manifest: ${name}`);
          if (canonicalJsonSha256(exactPorts) !== declaration.port_contracts_sha256 || canonicalJson(exactPorts) !== canonicalJson(declaration.port_contracts)) {
            throw new Error(`dynamic Lib package port contracts mismatch: ${name}`);
          }
        }
        const resource = await this.boundary.install(declaration.root);
        const record = {
          resource,
          artifactSha: declaration.artifact_sha256,
          identity: declaration.identity,
          configuration: JSON.parse(canonicalJson(declaration.configuration)),
          configurationSha: declaration.configuration_sha256,
          witContractSha: declaration.wit_contract_sha256,
          statePolicy: declaration.state_policy,
          stateSchemaIdentity: declaration.state_schema_identity,
          portContracts: exactPorts ? structuredClone(exactPorts) : null,
          portContractsSha: exactPorts ? canonicalJsonSha256(exactPorts) : null,
        };
        installed.push(record);
        candidateBlocks.set(name, record);
        await this.#call(resource, { operation: "probe", configuration: record.configuration });
        await this.#call(resource, { operation: "health", configuration: record.configuration });
      }
      const candidate = {
        revision: old.revision + 1,
        graphDigest: graph_digest,
        blocks: candidateBlocks,
        shape: dag ? "general-dag" : "serial-dag",
        pipeline: pipeline ? [...pipeline] : [],
        edges: dag ? structuredClone(edges) : [],
        entrypoint: dag ? structuredClone(entrypoint) : null,
        levels: dag ? described.levels.map((level) => [...level]) : [],
        inflight: 0,
        drainWaiters: [],
      };
      for (const block of candidate.blocks.values()) await this.#call(block.resource, { operation: "health", configuration: block.configuration });
      this.active = candidate;
      published = true;
      const retired = old.graphDigest === null ? null : { generation: old, retainedResources: new Set([...candidate.blocks.values()].map((block) => block.resource)), onRetired };
      if (retired) this.retired.add(retired);
      await onPublished?.({
        active: { revision: candidate.revision, graph_digest: candidate.graphDigest },
        retired: retired ? { revision: old.revision, graph_digest: old.graphDigest } : null,
      });
      const released = retired ? await this.#cleanupRetired(retired) : 0;
      return { outcome: "committed", revision: candidate.revision, graph_digest, installed: installed.length, reused, released, pipeline: pipeline ? [...pipeline] : [], shape: candidate.shape };
    } catch (error) {
      if (published) {
        return { outcome: "committed", revision: this.active.revision, graph_digest: this.active.graphDigest, installed: installed.length, reused, released: 0, cleanup_error: error.message, pipeline: [...this.active.pipeline] };
      }
      this.active = old;
      for (const block of installed) this.boundary.releaseResource(block.resource);
      return { outcome: "rolled-back", revision: old.revision, graph_digest: old.graphDigest, installed: installed.length, reused, released: installed.length, error: error.message, pipeline: [...old.pipeline] };
    } finally {
      this.updateInProgress = false;
    }
  }

  async invoke(value) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    const generation = this.active;
    generation.inflight += 1;
    try {
      if (generation.shape === "general-dag") return { revision: generation.revision, value: await this.#invokeDag(generation, value) };
      let current = value;
      for (const name of generation.pipeline) {
        const block = generation.blocks.get(name);
        const response = await this.#call(block.resource, { operation: "invoke", value: current, configuration: block.configuration });
        if (response.accepted !== true) throw new Error(`dynamic Lib block rejected invocation: ${name}`);
        current = response.value;
      }
      return { revision: generation.revision, value: current };
    } finally {
      generation.inflight -= 1;
      if (generation.inflight === 0) {
        for (const resolve of generation.drainWaiters.splice(0)) resolve();
      }
    }
  }

  async #invokeDag(generation, value) {
    const inputs = new Map();
    const key = ({ node, port }) => `${node}:${port}`;
    inputs.set(key(generation.entrypoint.input), value);
    const outgoing = new Map();
    for (const edge of generation.edges) {
      const source = key(edge.from);
      const list = outgoing.get(source) ?? [];
      list.push(edge.to);
      outgoing.set(source, list);
    }
    const produced = new Map();
    for (const level of generation.levels) {
      await Promise.all(level.map(async (name) => {
        const block = generation.blocks.get(name);
        const nodeInputs = Object.fromEntries(Object.keys(block.portContracts.inputs).map((port) => {
          const input = key({ node: name, port });
          if (!inputs.has(input)) throw new Error(`dynamic Lib DAG input unavailable: ${input}`);
          return [port, inputs.get(input)];
        }));
        const response = await this.#call(block.resource, { operation: "invoke-ports", inputs: nodeInputs, configuration: block.configuration });
        if (response.accepted !== true || !response.outputs || typeof response.outputs !== "object") throw new Error(`dynamic Lib block rejected DAG invocation: ${name}`);
        for (const port of Object.keys(block.portContracts.outputs)) {
          if (!Object.hasOwn(response.outputs, port)) throw new Error(`dynamic Lib block omitted DAG output: ${name}:${port}`);
          const output = key({ node: name, port });
          produced.set(output, response.outputs[port]);
          for (const target of outgoing.get(output) ?? []) inputs.set(key(target), response.outputs[port]);
        }
      }));
    }
    const output = key(generation.entrypoint.output);
    if (!produced.has(output)) throw new Error(`dynamic Lib DAG output unavailable: ${output}`);
    return produced.get(output);
  }

  async close() {
    if (this.closed) return;
    if (this.updateInProgress) throw new Error("cannot close dynamic Lib graph during an update");
    this.closed = true;
    await this.#drain(this.active);
    for (const retired of [...this.retired]) await this.#cleanupRetired(retired);
    for (const block of new Set(this.active.blocks.values())) this.boundary.releaseResource(block.resource);
    this.active.blocks.clear();
  }

  async #drain(generation) {
    if (generation.inflight === 0) return;
    await new Promise((resolve) => generation.drainWaiters.push(resolve));
  }

  async #cleanupRetired(retired) {
    await this.#drain(retired.generation);
    let released = 0;
    for (const block of new Set(retired.generation.blocks.values())) {
      if (!retired.retainedResources.has(block.resource)) {
        this.boundary.releaseResource(block.resource);
        released += 1;
      }
    }
    this.retired.delete(retired);
    await retired.onRetired?.({ revision: retired.generation.revision, graph_digest: retired.generation.graphDigest, released });
    return released;
  }

  async #call(resource, request) {
    const window = this.boundary.acquireWindow(encoder.encode(JSON.stringify(request)));
    const operation = this.boundary.submit(resource, window);
    try {
      await this.boundary.wait([operation]);
      const completion = this.boundary.claim(operation);
      if (completion.state !== "completed") throw new Error(completion.error ?? completion.state);
      return JSON.parse(decoder.decode(completion.bytes));
    } finally {
      try { this.boundary.releaseOperation(operation); } finally { this.boundary.releaseWindow(window); }
    }
  }
}
