import { createHash, randomUUID } from "node:crypto";
import https from "node:https";
import { once } from "node:events";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { LibDefinedBoundary } from "../../host/runtime/lib-boundary/reference.mjs";
import { connectWss } from "./wss-transport.mjs";
import { DynamicLibGraph } from "./dynamic-lib-graph.mjs";
import { canonicalJson, canonicalJsonSha256, describeDynamicLibDag, describeSerialLibGraph, identifyDynamicLibPackageFiles } from "./dynamic-lib-graph-spec.mjs";
import { validateWitPortManifest } from "./wit-port-contracts.mjs";

const STATE_SCHEMA = "wasmc.dynamic-client-foundation-state/v1";
const BUNDLE_SCHEMA = "wasmc.client-foundation-bundle/v1";
const CONTROL_SCHEMA = "wasmc.client-foundation-control/v1";
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_RETIRED_CLEANUP_RECEIPTS = 128;
const REQUIRED_FILES = new Set(["lib.wit", "native-boundary.json", "native-adapter.mjs"]);
const ALLOWED_FILES = new Set([...REQUIRED_FILES, "graph-ports.json"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const delay = (milliseconds, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

async function download(url, ca) {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("dynamic Lib artifact URL must use https");
  return new Promise((resolve, reject) => {
    const request = https.get(target, { ca, rejectUnauthorized: true }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`dynamic Lib artifact HTTP status ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_ARTIFACT_BYTES) request.destroy(new Error("dynamic Lib artifact size limit"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.on("error", reject);
  });
}

function decodeBundle(bytes) {
  const bundle = JSON.parse(bytes.toString("utf8"));
  if (bundle.schema !== BUNDLE_SCHEMA || typeof bundle.identity !== "string" || !Array.isArray(bundle.files)) throw new Error("invalid dynamic Lib bundle");
  const entries = [];
  const seen = new Set();
  for (const file of bundle.files) {
    if (!ALLOWED_FILES.has(file.path) || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.base64 !== "string") {
      throw new Error("invalid dynamic Lib bundle file");
    }
    const decoded = Buffer.from(file.base64, "base64");
    if (sha256(decoded) !== file.sha256) throw new Error(`dynamic Lib bundle file identity mismatch: ${file.path}`);
    seen.add(file.path);
    entries.push({ path: file.path, bytes: decoded });
  }
  if ([...REQUIRED_FILES].some((name) => !seen.has(name))) throw new Error("incomplete dynamic Lib bundle");
  const exact = identifyDynamicLibPackageFiles(entries);
  if (exact.graph_ports) validateWitPortManifest(exact.graph_ports, entries.find((entry) => entry.path === exact.descriptor.wit).bytes);
  if (exact.identity !== bundle.identity) throw new Error("dynamic Lib bundle descriptor identity mismatch");
  return { bundle, entries, exact };
}

export class DynamicGraphClientFoundation {
  constructor({ stateRoot, gatewayUrl, ca, reconnectDelayMs = 50, boundary, afterPublicationPersist } = {}) {
    if (!stateRoot || !gatewayUrl || !ca) throw new Error("incomplete Dynamic Graph Client configuration");
    this.stateRoot = path.resolve(stateRoot);
    this.gatewayUrl = gatewayUrl;
    this.ca = ca;
    this.reconnectDelayMs = reconnectDelayMs;
    this.boundary = boundary ?? new LibDefinedBoundary();
    this.instanceId = randomUUID();
    this.afterPublicationPersist = afterPublicationPersist;
    this.statePath = path.join(this.stateRoot, "dynamic-state.json");
    this.journalPath = path.join(this.stateRoot, "dynamic-journal.jsonl");
    this.artifactRoot = path.join(this.stateRoot, "lib-artifacts");
    this.state = null;
    this.graph = null;
    this.connection = null;
    this.initialized = false;
    this.runtimeAvailable = false;
  }

  async initialize() {
    if (this.initialized) return;
    await mkdir(this.artifactRoot, { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (this.state.schema !== STATE_SCHEMA) throw new Error("unsupported Dynamic Graph Client state");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = {
        schema: STATE_SCHEMA,
        graph_revision: 0,
        active_graph: null,
        last_server_sequence: 0,
        receipts: {},
        inflight_command: null,
        inflight_result: null,
        retired_generations: [],
        retired_cleanup_receipts: [],
      };
      await this.#persist("initialized");
    }
    this.state.retired_generations ??= [];
    this.state.retired_cleanup_receipts ??= [];
    await this.#recoverRetiredGenerations();
    if (!Number.isSafeInteger(this.state.graph_revision) || this.state.graph_revision < 0) throw new Error("invalid persisted graph revision");
    if (this.state.inflight_command && this.state.inflight_result) {
      const command = this.state.inflight_command;
      const receipt = { message_id: command.message_id, sequence: command.sequence, operation: command.operation, replayed: false, ...this.state.inflight_result };
      this.state.last_server_sequence = command.sequence;
      this.state.receipts[command.message_id] = receipt;
      this.state.inflight_command = null;
      this.state.inflight_result = null;
      await this.#persist("command-recovered", { message_id: receipt.message_id, outcome: receipt.outcome });
    }
    if (this.state.active_graph) await this.#restoreActiveGraph();
    else this.graph = new DynamicLibGraph({ boundary: this.boundary, initialRevision: this.state.graph_revision });
    this.initialized = true;
  }

  async invoke(value) {
    await this.initialize();
    if (!this.runtimeAvailable || !this.state.active_graph) throw new Error("dynamic Lib graph runtime unavailable");
    return this.graph.invoke(value);
  }

  async run(signal) {
    await this.initialize();
    while (!signal?.aborted) {
      try { await this.#runConnection(signal); }
      catch (error) { if (!signal?.aborted) await this.#journal("control-disconnected", { error: error.message }); }
      if (!signal?.aborted) await delay(this.reconnectDelayMs, signal);
    }
  }

  async close() {
    this.connection?.close();
    this.connection = null;
    if (this.graph) await this.graph.close();
    this.graph = null;
    this.runtimeAvailable = false;
    this.initialized = false;
  }

  snapshot() {
    return { ...structuredClone(this.state), runtime_available: this.runtimeAvailable, runtime: this.graph?.snapshot() ?? null };
  }

  async #runConnection(signal) {
    const connection = await connectWss(this.gatewayUrl, { ca: this.ca, signal });
    if (signal?.aborted) {
      connection.close();
      return;
    }
    this.connection = connection;
    connection.sendJson({
      type: "hello",
      schema: CONTROL_SCHEMA,
      last_server_sequence: this.state.last_server_sequence,
      graph_revision: this.state.graph_revision,
      graph_digest: this.state.active_graph?.graph_digest ?? null,
      runtime_available: this.runtimeAvailable,
      active: this.state.active_graph ? { graph_digest: this.state.active_graph.graph_digest } : null,
    });
    let chain = Promise.resolve();
    connection.on("message", (message) => {
      chain = chain.then(async () => connection.sendJson({ type: "receipt", ...await this.#handleMessage(message) }))
        .catch((error) => connection.emit("error", error));
    });
    const outcome = await Promise.race([
      once(connection, "close").then(() => null),
      once(connection, "error").then(([error]) => error),
      signal ? once(signal, "abort").then(() => null) : new Promise(() => {}),
    ]);
    connection.close();
    await chain;
    if (this.connection === connection) this.connection = null;
    if (outcome) throw outcome;
  }

  async #handleMessage(message) {
    if (message?.type !== "command" || typeof message.message_id !== "string" || !Number.isSafeInteger(message.sequence)) throw new Error("invalid dynamic control message");
    const cached = this.state.receipts[message.message_id];
    if (cached) {
      if (cached.sequence !== message.sequence || cached.operation !== message.operation) throw new Error("dynamic command replay identity mismatch");
      return { ...cached, replayed: true };
    }
    if (message.sequence !== this.state.last_server_sequence + 1) throw new Error("dynamic control sequence gap");
    if (this.state.inflight_command) {
      if (this.state.inflight_command.message_id !== message.message_id || this.state.inflight_command.sequence !== message.sequence) throw new Error("different dynamic command while one is inflight");
    } else {
      this.state.inflight_command = { message_id: message.message_id, sequence: message.sequence, operation: message.operation, payload: message.payload ?? {} };
      this.state.inflight_result = null;
      await this.#persist("command-started", { message_id: message.message_id, operation: message.operation });
    }
    let result;
    try {
      if (message.operation === "inventory.report") result = { outcome: "reported", graph_revision: this.state.graph_revision, active_graph: this.state.active_graph, runtime_available: this.runtimeAvailable };
      else if (message.operation === "lib-graph.apply") result = await this.#applyGraph(message.payload ?? {});
      else if (message.operation === "invoke") result = { outcome: "completed", response: await this.invoke(message.payload?.value ?? "") };
      else throw new Error(`unsupported dynamic control operation ${JSON.stringify(message.operation)}`);
    } catch (error) {
      result = { outcome: "rejected", graph_revision: this.state.graph_revision, graph_digest: this.state.active_graph?.graph_digest ?? null, error: error.message };
    }
    if (!this.state.inflight_result) {
      this.state.inflight_result = result;
      await this.#persist("command-result", { message_id: message.message_id, outcome: result.outcome });
    }
    const receipt = { message_id: message.message_id, sequence: message.sequence, operation: message.operation, replayed: false, ...this.state.inflight_result };
    this.state.last_server_sequence = message.sequence;
    this.state.receipts[message.message_id] = receipt;
    this.state.inflight_command = null;
    this.state.inflight_result = null;
    await this.#persist("command-completed", { message_id: message.message_id, outcome: receipt.outcome });
    return receipt;
  }

  async #applyGraph(payload) {
    if (payload.expected_graph_revision !== this.state.graph_revision) throw new Error("dynamic graph revision fence mismatch");
    const dag = Array.isArray(payload.edges) || payload.entrypoint !== undefined;
    if (!Array.isArray(payload.blocks) || (!dag && !Array.isArray(payload.pipeline)) || typeof payload.graph_digest !== "string") throw new Error("incomplete dynamic graph command");
    const blocks = [];
    for (const declaration of payload.blocks) {
      const root = await this.#ensureBundle(declaration);
      blocks.push({ ...declaration, root, artifact_url: undefined, bundle_sha256: undefined });
    }
    const described = dag
      ? describeDynamicLibDag({ blocks, edges: payload.edges, entrypoint: payload.entrypoint })
      : describeSerialLibGraph({ blocks, pipeline: payload.pipeline });
    if (described.graph_digest !== payload.graph_digest) throw new Error("dynamic graph command identity mismatch");
    const active = {
      graph_digest: payload.graph_digest,
      shape: dag ? "general-dag" : "serial-dag",
      pipeline: payload.pipeline ? [...payload.pipeline] : [],
      edges: dag ? structuredClone(payload.edges) : [],
      entrypoint: dag ? structuredClone(payload.entrypoint) : null,
      blocks: payload.blocks.map((block) => {
        const stored = structuredClone(block);
        delete stored.artifact_url;
        return stored;
      }),
    };
    const result = await this.graph.apply({
      expected_revision: payload.expected_graph_revision, graph_digest: payload.graph_digest, blocks,
      pipeline: payload.pipeline, edges: payload.edges, entrypoint: payload.entrypoint,
      onPublished: async ({ active: published, retired }) => {
        this.state.graph_revision = published.revision;
        this.state.active_graph = active;
        this.runtimeAvailable = true;
        if (retired) this.state.retired_generations.push({ ...retired, owner_instance_id: this.instanceId, status: "pending" });
        this.state.inflight_result = { outcome: "committed", revision: published.revision, graph_digest: published.graph_digest, shape: active.shape, cleanup_pending: Boolean(retired), active_graph: active };
        await this.#persist("lib-graph-published", { graph_digest: published.graph_digest, graph_revision: published.revision, retired_revision: retired?.revision ?? null });
        await this.afterPublicationPersist?.({ revision: published.revision, graph_digest: published.graph_digest, retired });
      },
      onRetired: async (retired) => {
        this.state.retired_generations = this.state.retired_generations.filter((entry) => !(entry.owner_instance_id === this.instanceId && entry.revision === retired.revision));
        this.state.retired_cleanup_receipts.push({ ...retired, owner_instance_id: this.instanceId, outcome: "released-after-drain" });
        if (this.state.retired_cleanup_receipts.length > MAX_RETIRED_CLEANUP_RECEIPTS) this.state.retired_cleanup_receipts.splice(0, this.state.retired_cleanup_receipts.length - MAX_RETIRED_CLEANUP_RECEIPTS);
        if (this.state.inflight_result?.outcome === "committed") {
          this.state.inflight_result.cleanup_pending = false;
          this.state.inflight_result.retired_released = retired.released;
        }
        await this.#persist("retired-generation-released", retired);
      },
    });
    if (result.outcome === "committed" || result.outcome === "unchanged") {
      this.state.graph_revision = result.revision;
      this.state.active_graph = active;
      this.runtimeAvailable = true;
      this.state.inflight_result = { ...result, active_graph: active };
      await this.#persist(result.outcome === "committed" ? "lib-graph-committed" : "lib-graph-unchanged", { graph_digest: payload.graph_digest, graph_revision: result.revision });
      return this.state.inflight_result;
    }
    return result;
  }

  async #restoreActiveGraph() {
    const active = this.state.active_graph;
    const dag = active?.shape === "general-dag";
    if (!active || typeof active.graph_digest !== "string" || !Array.isArray(active.blocks) || (!dag && !Array.isArray(active.pipeline)) || (dag && (!Array.isArray(active.edges) || !active.entrypoint)) || this.state.graph_revision < 1) {
      throw new Error("invalid persisted active dynamic graph");
    }
    const blocks = [];
    let restoringGraph = null;
    try {
      for (const declaration of active.blocks) blocks.push({ ...declaration, root: await this.#verifyCachedBundle(declaration) });
      restoringGraph = new DynamicLibGraph({ boundary: this.boundary, initialRevision: this.state.graph_revision - 1 });
      const result = await restoringGraph.apply({ expected_revision: this.state.graph_revision - 1, graph_digest: active.graph_digest, blocks, pipeline: active.pipeline, edges: dag ? active.edges : undefined, entrypoint: dag ? active.entrypoint : undefined });
      if (result.outcome !== "committed" || result.revision !== this.state.graph_revision) throw new Error(result.error ?? "dynamic graph restore did not commit");
      this.graph = restoringGraph;
      this.runtimeAvailable = true;
      await this.#journal("lib-graph-restored", { graph_digest: active.graph_digest, graph_revision: result.revision });
    } catch (error) {
      await restoringGraph?.close().catch(() => {});
      this.graph = new DynamicLibGraph({ boundary: this.boundary, initialRevision: this.state.graph_revision });
      this.runtimeAvailable = false;
      await this.#journal("lib-graph-unavailable", { graph_digest: active.graph_digest, error: error.message });
    }
  }

  async #recoverRetiredGenerations() {
    if (!Array.isArray(this.state.retired_generations) || !Array.isArray(this.state.retired_cleanup_receipts)) throw new Error("invalid retired generation state");
    if (this.state.retired_generations.length === 0) return;
    for (const retired of this.state.retired_generations) {
      if (!Number.isSafeInteger(retired.revision) || retired.revision < 1 || typeof retired.graph_digest !== "string" || typeof retired.owner_instance_id !== "string") {
        throw new Error("invalid persisted retired generation");
      }
      this.state.retired_cleanup_receipts.push({
        revision: retired.revision,
        graph_digest: retired.graph_digest,
        owner_instance_id: retired.owner_instance_id,
        recovered_by_instance_id: this.instanceId,
        outcome: "process-owner-fenced-on-restart",
      });
    }
    if (this.state.retired_cleanup_receipts.length > MAX_RETIRED_CLEANUP_RECEIPTS) this.state.retired_cleanup_receipts.splice(0, this.state.retired_cleanup_receipts.length - MAX_RETIRED_CLEANUP_RECEIPTS);
    this.state.retired_generations = [];
    await this.#persist("retired-generations-recovered", { outcome: "process-owner-fenced-on-restart" });
  }

  async #ensureBundle(declaration) {
    if (!/^[a-f0-9]{64}$/.test(declaration.bundle_sha256) || typeof declaration.artifact_url !== "string") throw new Error("incomplete dynamic Lib transport identity");
    const target = path.join(this.artifactRoot, declaration.bundle_sha256);
    try { return await this.#verifyCachedBundle(declaration); }
    catch (error) {
      if (error.code !== "ENOENT") {
        await this.#journal("invalid-lib-artifact-cache-detected", { bundle_sha256: declaration.bundle_sha256, error: error.message });
      }
    }
    const bytes = await download(declaration.artifact_url, this.ca);
    if (sha256(bytes) !== declaration.bundle_sha256) throw new Error("dynamic Lib bundle transport identity mismatch");
    const decoded = decodeBundle(bytes);
    this.#matchDeclaration(declaration, decoded.exact);
    const staging = `${target}.next`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, "bundle.json"), bytes, { flag: "wx" });
    for (const entry of decoded.entries) await writeFile(path.join(staging, entry.path), entry.bytes, { flag: "wx" });
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return this.#verifyCachedBundle(declaration);
  }

  async #verifyCachedBundle(declaration) {
    if (!/^[a-f0-9]{64}$/.test(declaration.bundle_sha256)) throw new Error("invalid cached dynamic Lib transport identity");
    const root = path.join(this.artifactRoot, declaration.bundle_sha256);
    const bytes = await readFile(path.join(root, "bundle.json"));
    if (sha256(bytes) !== declaration.bundle_sha256) throw new Error("cached dynamic Lib bundle identity mismatch");
    const decoded = decodeBundle(bytes);
    this.#matchDeclaration(declaration, decoded.exact);
    for (const entry of decoded.entries) {
      if (!Buffer.from(await readFile(path.join(root, entry.path))).equals(entry.bytes)) throw new Error(`cached dynamic Lib file identity mismatch: ${entry.path}`);
    }
    return root;
  }

  #matchDeclaration(declaration, exact) {
    if (exact.identity !== declaration.identity) throw new Error(`dynamic Lib transport identity mismatch: ${declaration.name}`);
    if (exact.artifact_sha256 !== declaration.artifact_sha256) throw new Error(`dynamic Lib transported package mismatch: ${declaration.name}`);
    if (exact.wit_contract_sha256 !== declaration.wit_contract_sha256) throw new Error(`dynamic Lib transported WIT mismatch: ${declaration.name}`);
    const exactState = exact.descriptor.state ?? { policy: "stateless", schema_identity: null };
    if (exactState.policy !== declaration.state_policy || exactState.schema_identity !== declaration.state_schema_identity) {
      throw new Error(`dynamic Lib transported state contract mismatch: ${declaration.name}`);
    }
    if (declaration.port_contracts_sha256) {
      const exactPorts = exact.graph_ports ? { inputs: exact.graph_ports.inputs, outputs: exact.graph_ports.outputs } : null;
      if (!exactPorts || canonicalJsonSha256(exactPorts) !== declaration.port_contracts_sha256 || canonicalJson(exactPorts) !== canonicalJson(declaration.port_contracts)) {
        throw new Error(`dynamic Lib transported port contracts mismatch: ${declaration.name}`);
      }
    }
  }

  async #persist(event, details = {}) {
    const next = `${this.statePath}.next`;
    await writeFile(next, `${JSON.stringify(this.state, null, 2)}\n`);
    await rename(next, this.statePath);
    await this.#journal(event, details);
  }

  async #journal(event, details = {}) {
    await appendFile(this.journalPath, `${JSON.stringify({ at: new Date().toISOString(), event, ...details })}\n`);
  }
}
