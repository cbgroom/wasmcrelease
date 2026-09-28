import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, canonicalJsonSha256, describeDynamicLibDag, describeSerialLibGraph, describeStateMigrations, identifyDynamicLibPackageFiles } from "./dynamic-lib-graph-spec.mjs";
import { validateWitPortManifest } from "./wit-port-contracts.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAX_SNAPSHOT_BYTES = 1024 * 1024;
const CHECKPOINT_SCHEMA = "wasmc.dynamic-lib-state-checkpoint/v1";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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
    this.checkpointInProgress = false;
    this.restoreFailed = false;
    this.invocationBarrier = null;
  }

  snapshot() {
    return {
      revision: this.active.revision,
      graph_digest: this.active.graphDigest,
      pipeline: [...this.active.pipeline],
      shape: this.active.shape,
      edges: structuredClone(this.active.edges),
      entrypoint: structuredClone(this.active.entrypoint),
      invocation_barrier_active: this.invocationBarrier !== null,
      restore_failed: this.restoreFailed,
      retired: [...this.retired].map(({ generation }) => ({ revision: generation.revision, graph_digest: generation.graphDigest, inflight: generation.inflight })),
      blocks: Object.fromEntries([...this.active.blocks].map(([name, block]) => [name, {
        identity: block.identity,
        artifact_sha256: block.artifactSha,
        configuration_sha256: block.configurationSha,
        wit_contract_sha256: block.witContractSha,
        state_policy: block.statePolicy,
        state_schema_identity: block.stateSchemaIdentity,
        state_restart_disposition: block.stateRestartDisposition,
        port_contracts_sha256: block.portContractsSha ?? null,
      }])),
    };
  }

  async apply({ expected_revision, graph_digest, blocks, pipeline, edges, entrypoint, migrations = [], migration_plan_sha256 = null, onPublished, onRetired }) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.restoreFailed) throw new Error("dynamic Lib graph restore failed; close and reconstruct the graph");
    if (this.updateInProgress) throw new Error("dynamic Lib graph update already in progress");
    if (this.checkpointInProgress) throw new Error("dynamic Lib graph checkpoint already in progress");
    if (this.retired.size > 0) throw new Error("dynamic Lib graph retired cleanup pending");
    if (expected_revision !== this.active.revision) throw new Error("dynamic Lib graph revision fence mismatch");
    const dag = Array.isArray(edges) || entrypoint !== undefined;
    const described = dag ? describeDynamicLibDag({ blocks, edges, entrypoint }) : describeSerialLibGraph({ blocks, pipeline });
    if (graph_digest !== described.graph_digest) throw new Error("dynamic Lib graph digest mismatch");
    const describedMigrations = migrations.length > 0 ? describeStateMigrations({ migrations }) : null;
    if ((describedMigrations?.migration_plan_sha256 ?? null) !== migration_plan_sha256) throw new Error("dynamic Lib state migration plan identity mismatch");
    const migrationDeclarations = new Map(migrations.map((migration) => [migration.node, migration]));
    const desired = new Map(blocks.map((block) => [block.name, block]));
    if (graph_digest === this.active.graphDigest) {
      if (migrations.length > 0) throw new Error("dynamic Lib state migration plan is invalid for an unchanged graph");
      return { outcome: "unchanged", revision: this.active.revision, graph_digest, installed: 0, reused: desired.size, released: 0, pipeline: pipeline ? [...pipeline] : [], shape: dag ? "general-dag" : "serial-dag" };
    }

    const old = this.active;
    const candidateBlocks = new Map();
    const installed = [];
    const migrationResources = [];
    const snapshotMigrations = [];
    const usedMigrationNodes = new Set();
    let reused = 0;
    let published = false;
    let releaseInvocationBarrier = null;
    this.updateInProgress = true;
    try {
      for (const [name, current] of old.blocks) {
        if (!desired.has(name) && current.statePolicy !== "stateless") throw new Error(`dynamic Lib stateful node removal requires an explicit state disposition: ${name}`);
      }
      for (const [name, declaration] of desired) {
        const current = old.blocks.get(name);
        if (current?.artifactSha === declaration.artifact_sha256 && current.configurationSha === declaration.configuration_sha256) {
          if (current.identity !== declaration.identity || current.witContractSha !== declaration.wit_contract_sha256 || current.statePolicy !== declaration.state_policy || current.stateSchemaIdentity !== declaration.state_schema_identity || current.stateRestartDisposition !== (declaration.state_restart_disposition ?? null) || (dag && current.portContractsSha !== declaration.port_contracts_sha256)) {
            throw new Error(`dynamic Lib identity conflicts with retained instance: ${name}`);
          }
          candidateBlocks.set(name, current);
          reused += 1;
          continue;
        }
        if (current) {
          if (current.statePolicy === "sticky" || declaration.state_policy === "sticky") throw new Error(`sticky dynamic Lib node cannot be replaced automatically: ${name}`);
          if (current.statePolicy !== declaration.state_policy) throw new Error(`dynamic Lib state policy transition is unsupported: ${name}`);
          if (current.statePolicy === "snapshot-v1" && current.stateSchemaIdentity !== declaration.state_schema_identity && !migrationDeclarations.has(name)) throw new Error(`dynamic Lib snapshot schema migration requires an exact migration Lib: ${name}`);
        }
        const exact = await inspectDynamicLibPackage(declaration.root);
        if (exact.identity !== declaration.identity) throw new Error(`dynamic Lib descriptor identity mismatch: ${name}`);
        if (exact.artifact_sha256 !== declaration.artifact_sha256) throw new Error(`dynamic Lib package identity mismatch: ${name}`);
        if (exact.wit_contract_sha256 !== declaration.wit_contract_sha256) throw new Error(`dynamic Lib WIT contract identity mismatch: ${name}`);
        const exactState = exact.descriptor.state ?? { policy: "stateless", schema_identity: null };
        if (exactState.policy !== declaration.state_policy || exactState.schema_identity !== declaration.state_schema_identity) {
          throw new Error(`dynamic Lib package state contract mismatch: ${name}`);
        }
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
          stateRestartDisposition: declaration.state_restart_disposition ?? null,
          portContracts: exactPorts ? structuredClone(exactPorts) : null,
          portContractsSha: exactPorts ? canonicalJsonSha256(exactPorts) : null,
        };
        installed.push(record);
        candidateBlocks.set(name, record);
        await this.#call(resource, { operation: "probe", configuration: record.configuration });
        await this.#call(resource, { operation: "health", configuration: record.configuration });
        if (current?.statePolicy === "snapshot-v1") {
          let migration = null;
          if (current.stateSchemaIdentity !== record.stateSchemaIdentity) {
            const declaration = migrationDeclarations.get(name);
            if (declaration.from_schema_identity !== current.stateSchemaIdentity || declaration.to_schema_identity !== record.stateSchemaIdentity) throw new Error(`dynamic Lib state migration schema binding mismatch: ${name}`);
            const exactMigration = await inspectDynamicLibPackage(declaration.root);
            const contract = exactMigration.descriptor.state_migration;
            if (exactMigration.identity !== declaration.identity || exactMigration.artifact_sha256 !== declaration.artifact_sha256 || exactMigration.wit_contract_sha256 !== declaration.wit_contract_sha256) throw new Error(`dynamic Lib state migration package identity mismatch: ${name}`);
            if (contract?.protocol !== "snapshot-v1" || contract.from_schema_identity !== declaration.from_schema_identity || contract.to_schema_identity !== declaration.to_schema_identity) throw new Error(`dynamic Lib state migration package contract mismatch: ${name}`);
            const resource = await this.boundary.install(declaration.root);
            migration = { resource, configuration: JSON.parse(canonicalJson(declaration.configuration)), fromSchemaIdentity: declaration.from_schema_identity, toSchemaIdentity: declaration.to_schema_identity };
            migrationResources.push(migration);
            usedMigrationNodes.add(name);
            await this.#call(resource, { operation: "probe", configuration: migration.configuration });
            await this.#call(resource, { operation: "health", configuration: migration.configuration });
          }
          snapshotMigrations.push({ name, source: current, target: record, migration });
        }
      }
      if (usedMigrationNodes.size !== migrationDeclarations.size) throw new Error("dynamic Lib state migration plan contains an unused declaration");
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
      if (snapshotMigrations.length > 0) {
        releaseInvocationBarrier = this.#beginInvocationBarrier();
        await this.#drain(old);
        for (const migration of snapshotMigrations) await this.#migrateSnapshot(migration);
      }
      for (const migration of migrationResources.splice(0)) this.boundary.releaseResource(migration.resource);
      for (const block of candidate.blocks.values()) await this.#call(block.resource, { operation: "health", configuration: block.configuration });
      const stateCheckpoint = await this.#captureGenerationCheckpoint(candidate);
      this.active = candidate;
      published = true;
      const retired = old.graphDigest === null ? null : { generation: old, retainedResources: new Set([...candidate.blocks.values()].map((block) => block.resource)), onRetired };
      if (retired) this.retired.add(retired);
      await onPublished?.({
        active: { revision: candidate.revision, graph_digest: candidate.graphDigest },
        retired: retired ? { revision: old.revision, graph_digest: old.graphDigest } : null,
        state_checkpoint: stateCheckpoint,
      });
      releaseInvocationBarrier?.();
      releaseInvocationBarrier = null;
      const released = retired ? await this.#cleanupRetired(retired) : 0;
      return { outcome: "committed", revision: candidate.revision, graph_digest, installed: installed.length, reused, released, migrated: snapshotMigrations.length, migration_libs: usedMigrationNodes.size, pipeline: pipeline ? [...pipeline] : [], shape: candidate.shape };
    } catch (error) {
      if (published) {
        return { outcome: "committed", revision: this.active.revision, graph_digest: this.active.graphDigest, installed: installed.length, reused, released: 0, cleanup_error: error.message, pipeline: [...this.active.pipeline] };
      }
      this.active = old;
      for (const migration of migrationResources) this.boundary.releaseResource(migration.resource);
      for (const block of installed) this.boundary.releaseResource(block.resource);
      return { outcome: "rolled-back", revision: old.revision, graph_digest: old.graphDigest, installed: installed.length, reused, released: installed.length, error: error.message, pipeline: [...old.pipeline] };
    } finally {
      releaseInvocationBarrier?.();
      this.updateInProgress = false;
    }
  }

  async invoke(value) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.restoreFailed) throw new Error("dynamic Lib graph restore failed; close and reconstruct the graph");
    while (this.invocationBarrier) await this.invocationBarrier.promise;
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

  async captureStateCheckpoint({ onCaptured } = {}) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.restoreFailed) throw new Error("dynamic Lib graph restore failed; close and reconstruct the graph");
    if (this.updateInProgress) throw new Error("dynamic Lib graph update already in progress");
    if (this.checkpointInProgress) throw new Error("dynamic Lib graph checkpoint already in progress");
    if (this.retired.size > 0) throw new Error("dynamic Lib graph retired cleanup pending");
    this.checkpointInProgress = true;
    const releaseInvocationBarrier = this.#beginInvocationBarrier();
    try {
      const generation = this.active;
      await this.#drain(generation);
      const checkpoint = await this.#captureGenerationCheckpoint(generation);
      await onCaptured?.(checkpoint);
      return checkpoint;
    } finally {
      releaseInvocationBarrier();
      this.checkpointInProgress = false;
    }
  }

  async restoreStateCheckpoint(checkpoint) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.restoreFailed) throw new Error("dynamic Lib graph restore failed; close and reconstruct the graph");
    if (this.updateInProgress) throw new Error("dynamic Lib graph update already in progress");
    if (this.checkpointInProgress) throw new Error("dynamic Lib graph checkpoint already in progress");
    if (this.retired.size > 0) throw new Error("dynamic Lib graph retired cleanup pending");
    const snapshotBlocks = [...this.active.blocks.entries()].filter(([, block]) => block.statePolicy === "snapshot-v1").sort(([left], [right]) => left.localeCompare(right));
    const stickyBlocks = [...this.active.blocks.entries()].filter(([, block]) => block.statePolicy === "sticky").sort(([left], [right]) => left.localeCompare(right));
    const blockedSticky = stickyBlocks.filter(([, block]) => block.stateRestartDisposition !== "reset-on-restart").map(([name]) => name);
    if (blockedSticky.length > 0) throw new Error(`sticky dynamic Lib active state restart disposition is fail-closed: ${blockedSticky.join(",")}`);
    if (snapshotBlocks.length === 0) {
      if (checkpoint !== null && checkpoint !== undefined) throw new Error("unexpected dynamic Lib state checkpoint for stateless graph");
      if (stickyBlocks.length === 0) return { restored: 0, checkpoint_sha256: null };
    } else this.#validateCheckpointIdentity(checkpoint, snapshotBlocks);
    this.checkpointInProgress = true;
    const releaseInvocationBarrier = this.#beginInvocationBarrier();
    try {
      await this.#drain(this.active);
      for (const [name, target] of stickyBlocks) await this.#resetStickyState(name, target);
      const checkpointByName = new Map((checkpoint?.blocks ?? []).map((block) => [block.name, block]));
      for (const [name, target] of snapshotBlocks) await this.#restoreSnapshotEnvelope(name, target, checkpointByName.get(name));
      for (const block of this.active.blocks.values()) await this.#call(block.resource, { operation: "health", configuration: block.configuration });
      return { restored: snapshotBlocks.length, ...(stickyBlocks.length > 0 ? { reset: stickyBlocks.length, reset_nodes: stickyBlocks.map(([name]) => name) } : {}), checkpoint_sha256: checkpoint?.checkpoint_sha256 ?? null };
    } catch (error) {
      this.restoreFailed = true;
      throw error;
    } finally {
      releaseInvocationBarrier();
      this.checkpointInProgress = false;
    }
  }

  async #resetStickyState(name, target) {
    const response = await this.#call(target.resource, {
      operation: "reset-state-v1",
      state_schema_identity: target.stateSchemaIdentity,
      configuration: target.configuration,
    });
    if (response.accepted !== true || response.state_schema_identity !== target.stateSchemaIdentity) throw new Error(`sticky dynamic Lib reset rejected: ${name}`);
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
    if (this.checkpointInProgress) throw new Error("cannot close dynamic Lib graph during a checkpoint");
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

  #beginInvocationBarrier() {
    if (this.invocationBarrier) throw new Error("dynamic Lib invocation barrier already active");
    let resolve;
    const barrier = { promise: new Promise((done) => { resolve = done; }) };
    this.invocationBarrier = barrier;
    return () => {
      if (this.invocationBarrier === barrier) this.invocationBarrier = null;
      resolve();
    };
  }

  async #migrateSnapshot({ name, source, target, migration }) {
    const snapshot = await this.#call(source.resource, {
      operation: "snapshot-v1",
      state_schema_identity: source.stateSchemaIdentity,
      configuration: source.configuration,
    });
    let envelope = this.#validateSnapshotEnvelope(name, source.stateSchemaIdentity, snapshot);
    if (migration) {
      const migrated = await this.#call(migration.resource, {
        operation: "migrate-state-v1",
        from_schema_identity: migration.fromSchemaIdentity,
        to_schema_identity: migration.toSchemaIdentity,
        state_base64: envelope.state_base64,
        state_sha256: envelope.state_sha256,
        configuration: migration.configuration,
      });
      envelope = this.#validateSnapshotEnvelope(name, target.stateSchemaIdentity, migrated);
    }
    await this.#restoreSnapshotEnvelope(name, target, envelope);
  }

  async #captureGenerationCheckpoint(generation) {
    const blocks = [];
    for (const [name, block] of [...generation.blocks.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      if (block.statePolicy !== "snapshot-v1") continue;
      const snapshot = await this.#call(block.resource, {
        operation: "snapshot-v1",
        state_schema_identity: block.stateSchemaIdentity,
        configuration: block.configuration,
      });
      blocks.push({ name, ...this.#validateSnapshotEnvelope(name, block.stateSchemaIdentity, snapshot) });
    }
    if (blocks.length === 0) return null;
    const payload = {
      schema: CHECKPOINT_SCHEMA,
      graph_revision: generation.revision,
      graph_digest: generation.graphDigest,
      blocks,
    };
    return { ...payload, checkpoint_sha256: sha256(Buffer.from(canonicalJson(payload))) };
  }

  #validateSnapshotEnvelope(name, stateSchemaIdentity, snapshot) {
    if (snapshot?.accepted !== true || snapshot.state_schema_identity !== stateSchemaIdentity || typeof snapshot.state_base64 !== "string" || typeof snapshot.state_sha256 !== "string") {
      throw new Error(`dynamic Lib snapshot rejected or malformed: ${name}`);
    }
    const bytes = Buffer.from(snapshot.state_base64, "base64");
    if (bytes.length > MAX_SNAPSHOT_BYTES || bytes.toString("base64") !== snapshot.state_base64 || sha256(bytes) !== snapshot.state_sha256) {
      throw new Error(`dynamic Lib snapshot identity mismatch: ${name}`);
    }
    return {
      state_schema_identity: stateSchemaIdentity,
      state_base64: snapshot.state_base64,
      state_sha256: snapshot.state_sha256,
    };
  }

  async #restoreSnapshotEnvelope(name, target, envelope) {
    this.#validateSnapshotEnvelope(name, target.stateSchemaIdentity, { accepted: true, ...envelope });
    const restored = await this.#call(target.resource, {
      operation: "restore-v1",
      state_schema_identity: target.stateSchemaIdentity,
      state_base64: envelope.state_base64,
      state_sha256: envelope.state_sha256,
      configuration: target.configuration,
    });
    if (restored.accepted !== true || restored.state_schema_identity !== target.stateSchemaIdentity || restored.state_sha256 !== envelope.state_sha256) {
      throw new Error(`dynamic Lib snapshot restore rejected: ${name}`);
    }
  }

  #validateCheckpointIdentity(checkpoint, snapshotBlocks) {
    if (!checkpoint || checkpoint.schema !== CHECKPOINT_SCHEMA || checkpoint.graph_revision !== this.active.revision || checkpoint.graph_digest !== this.active.graphDigest || !Array.isArray(checkpoint.blocks) || !/^[a-f0-9]{64}$/.test(checkpoint.checkpoint_sha256 ?? "")) {
      throw new Error("invalid dynamic Lib active state checkpoint identity");
    }
    if (canonicalJson(Object.keys(checkpoint).sort()) !== canonicalJson(["blocks", "checkpoint_sha256", "graph_digest", "graph_revision", "schema"])) {
      throw new Error("invalid dynamic Lib active state checkpoint shape");
    }
    const payload = { schema: checkpoint.schema, graph_revision: checkpoint.graph_revision, graph_digest: checkpoint.graph_digest, blocks: checkpoint.blocks };
    if (sha256(Buffer.from(canonicalJson(payload))) !== checkpoint.checkpoint_sha256) throw new Error("dynamic Lib active state checkpoint digest mismatch");
    const expectedNames = snapshotBlocks.map(([name]) => name);
    const observedNames = checkpoint.blocks.map((block) => block?.name);
    if (new Set(observedNames).size !== observedNames.length || canonicalJson(observedNames) !== canonicalJson(expectedNames)) throw new Error("dynamic Lib active state checkpoint block mismatch");
    for (let index = 0; index < snapshotBlocks.length; index += 1) {
      const [name, target] = snapshotBlocks[index];
      if (canonicalJson(Object.keys(checkpoint.blocks[index]).sort()) !== canonicalJson(["name", "state_base64", "state_schema_identity", "state_sha256"])) {
        throw new Error(`invalid dynamic Lib active state checkpoint block shape: ${name}`);
      }
      this.#validateSnapshotEnvelope(name, target.stateSchemaIdentity, { accepted: true, ...checkpoint.blocks[index] });
    }
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
