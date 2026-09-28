import { createHash } from "node:crypto";
import https from "node:https";
import { once } from "node:events";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { LibDefinedBoundary } from "../../host/runtime/lib-boundary/reference.mjs";
import { connectWss } from "./wss-transport.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const BUNDLE_SCHEMA = "wasmc.client-foundation-bundle/v1";
const STATE_SCHEMA = "wasmc.client-foundation-state/v1";
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const ALLOWED_FILES = new Set(["lib.wit", "native-boundary.json", "native-adapter.mjs"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const delay = (milliseconds, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

async function download(url, { ca, maxBytes = MAX_ARTIFACT_BYTES }) {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("artifact URL must use https");
  return new Promise((resolve, reject) => {
    const request = https.get(target, { ca, rejectUnauthorized: true }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`artifact HTTP status ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) request.destroy(new Error("artifact size limit"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.on("error", reject);
  });
}

export class ClientFoundation {
  constructor({ stateRoot, factoryRoot, gatewayUrl, ca, reconnectDelayMs = 50, boundary } = {}) {
    if (!stateRoot || !factoryRoot || !gatewayUrl || !ca) throw new Error("incomplete Client Foundation configuration");
    this.stateRoot = path.resolve(stateRoot);
    this.factoryRoot = path.resolve(factoryRoot);
    this.gatewayUrl = gatewayUrl;
    this.ca = ca;
    this.reconnectDelayMs = reconnectDelayMs;
    this.boundary = boundary ?? new LibDefinedBoundary();
    this.statePath = path.join(this.stateRoot, "state.json");
    this.journalPath = path.join(this.stateRoot, "journal.jsonl");
    this.state = null;
    this.activeResource = null;
    this.connection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await mkdir(path.join(this.stateRoot, "slots"), { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (this.state.schema !== STATE_SCHEMA) throw new Error("unsupported Client Foundation state");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const identity = await this.#packageIdentity(this.factoryRoot);
      const factory = { kind: "factory", slot: null, identity, artifact_sha256: null };
      this.state = {
        schema: STATE_SCHEMA,
        phase: "committed",
        graph_revision: 1,
        active: factory,
        last_known_good: factory,
        slots: { A: null, B: null },
        last_server_sequence: 0,
        receipts: {},
        rollback_count: 0,
        probation_previous_revision: null,
        inflight_command: null,
        inflight_result: null,
      };
      await this.#persist("initialized");
    }
    if (this.state.phase !== "committed") {
      this.state.active = this.state.last_known_good;
      if (Number.isSafeInteger(this.state.probation_previous_revision)) {
        this.state.graph_revision = this.state.probation_previous_revision;
      }
      this.state.phase = "committed";
      this.state.probation_previous_revision = null;
      this.state.rollback_count += 1;
      await this.#persist("startup-rollback");
    }
    if (this.state.inflight_command && this.state.inflight_result) {
      const command = this.state.inflight_command;
      const receipt = {
        message_id: command.message_id,
        sequence: command.sequence,
        operation: command.operation,
        replayed: false,
        ...this.state.inflight_result,
      };
      this.state.last_server_sequence = command.sequence;
      this.state.receipts[command.message_id] = receipt;
      this.state.inflight_command = null;
      this.state.inflight_result = null;
      await this.#persist("command-recovered", { message_id: command.message_id, outcome: receipt.outcome });
    }
    try {
      this.activeResource = await this.#installProbed(this.#rootFor(this.state.active));
    } catch (error) {
      const identity = await this.#packageIdentity(this.factoryRoot);
      const factory = { kind: "factory", slot: null, identity, artifact_sha256: null };
      this.state.active = factory;
      this.state.last_known_good = factory;
      this.state.phase = "committed";
      this.state.probation_previous_revision = null;
      this.state.rollback_count += 1;
      await this.#persist("startup-factory-rescue", { error: error.message });
      this.activeResource = await this.#installProbed(this.factoryRoot);
    }
    this.initialized = true;
  }

  async invoke(value) {
    await this.initialize();
    return this.#call(this.activeResource, { operation: "invoke", value });
  }

  async run(signal) {
    await this.initialize();
    while (!signal?.aborted) {
      try {
        await this.#runConnection(signal);
      } catch (error) {
        if (!signal?.aborted) await this.#journal("control-disconnected", { error: error.message });
      }
      if (!signal?.aborted) await delay(this.reconnectDelayMs, signal);
    }
  }

  async close() {
    this.connection?.close();
    this.connection = null;
    if (this.activeResource !== null) {
      this.boundary.releaseResource(this.activeResource);
      this.activeResource = null;
    }
    this.initialized = false;
  }

  snapshot() {
    return structuredClone(this.state);
  }

  async #runConnection(signal) {
    const connection = await connectWss(this.gatewayUrl, { ca: this.ca });
    this.connection = connection;
    connection.sendJson({
      type: "hello",
      schema: "wasmc.client-foundation-control/v1",
      last_server_sequence: this.state.last_server_sequence,
      graph_revision: this.state.graph_revision,
      active: this.state.active,
    });
    let chain = Promise.resolve();
    connection.on("message", (message) => {
      chain = chain.then(async () => {
        const receipt = await this.#handleMessage(message);
        connection.sendJson({ type: "receipt", ...receipt });
      }).catch((error) => {
        connection.emit("error", error);
      });
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
    if (message?.type !== "command" || typeof message.message_id !== "string" || !Number.isSafeInteger(message.sequence)) {
      throw new Error("invalid control message");
    }
    const cached = this.state.receipts[message.message_id];
    if (cached) {
      if (cached.sequence !== message.sequence) throw new Error("message identity sequence mismatch");
      return { ...cached, replayed: true };
    }
    if (message.sequence !== this.state.last_server_sequence + 1) throw new Error("control sequence gap");
    if (this.state.inflight_command) {
      if (this.state.inflight_command.message_id !== message.message_id || this.state.inflight_command.sequence !== message.sequence) {
        throw new Error("different command while durable command is inflight");
      }
    } else {
      this.state.inflight_command = {
        message_id: message.message_id,
        sequence: message.sequence,
        operation: message.operation,
        payload: message.payload ?? {},
      };
      this.state.inflight_result = null;
      await this.#persist("command-started", { message_id: message.message_id, operation: message.operation });
    }
    let result;
    if (message.operation === "inventory.report") {
      result = { outcome: "reported", active: this.state.active, graph_revision: this.state.graph_revision };
    } else if (message.operation === "graph.apply") {
      result = await this.#applyGraph(message.payload ?? {});
    } else if (message.operation === "invoke") {
      result = { outcome: "completed", response: await this.invoke(message.payload?.value ?? "") };
    } else {
      throw new Error(`unsupported control operation ${JSON.stringify(message.operation)}`);
    }
    const receipt = {
      message_id: message.message_id,
      sequence: message.sequence,
      operation: message.operation,
      replayed: false,
      ...result,
    };
    this.state.last_server_sequence = message.sequence;
    this.state.receipts[message.message_id] = receipt;
    this.state.inflight_command = null;
    this.state.inflight_result = null;
    await this.#persist("command-completed", { message_id: message.message_id, outcome: receipt.outcome });
    return receipt;
  }

  async #applyGraph(payload) {
    if (payload.expected_graph_revision !== this.state.graph_revision) throw new Error("graph revision fence mismatch");
    if (typeof payload.artifact_url !== "string" || typeof payload.artifact_sha256 !== "string") {
      throw new Error("incomplete graph artifact identity");
    }
    const artifact = await download(payload.artifact_url, { ca: this.ca });
    if (sha256(artifact) !== payload.artifact_sha256) throw new Error("graph artifact identity mismatch");
    const bundle = JSON.parse(artifact.toString("utf8"));
    if (bundle.schema !== BUNDLE_SCHEMA || typeof bundle.identity !== "string" || !Array.isArray(bundle.files)) {
      throw new Error("invalid graph artifact bundle");
    }
    const inactive = this.state.active.kind === "slot" && this.state.active.slot === "A" ? "B" : "A";
    const slotRoot = path.join(this.stateRoot, "slots", inactive);
    const stagingRoot = `${slotRoot}.next`;
    await rm(stagingRoot, { recursive: true, force: true });
    await mkdir(stagingRoot, { recursive: true });
    const seen = new Set();
    for (const file of bundle.files) {
      if (!ALLOWED_FILES.has(file.path) || seen.has(file.path) || typeof file.sha256 !== "string" || typeof file.base64 !== "string") {
        throw new Error("invalid graph artifact file");
      }
      seen.add(file.path);
      const bytes = Buffer.from(file.base64, "base64");
      if (sha256(bytes) !== file.sha256) throw new Error(`graph artifact file identity mismatch: ${file.path}`);
      await writeFile(path.join(stagingRoot, file.path), bytes, { flag: "wx" });
    }
    if (![...ALLOWED_FILES].every((name) => seen.has(name))) throw new Error("incomplete graph artifact bundle");
    if (await this.#packageIdentity(stagingRoot) !== bundle.identity) throw new Error("bundle and descriptor identity mismatch");
    await rm(slotRoot, { recursive: true, force: true });
    await rename(stagingRoot, slotRoot);
    const candidateResource = await this.boundary.install(slotRoot);
    const oldResource = this.activeResource;
    const oldActive = structuredClone(this.state.active);
    const oldRevision = this.state.graph_revision;
    const candidate = { kind: "slot", slot: inactive, identity: bundle.identity, artifact_sha256: payload.artifact_sha256 };
    try {
      await this.#call(candidateResource, { operation: "probe" });
      await this.#call(candidateResource, { operation: "health" });
      this.state.last_known_good = oldActive;
      this.state.active = candidate;
      this.state.slots[inactive] = candidate;
      this.state.graph_revision = oldRevision + 1;
      this.state.phase = "active-probation";
      this.state.probation_previous_revision = oldRevision;
      this.activeResource = candidateResource;
      await this.#persist("graph-active-probation", { slot: inactive, identity: bundle.identity });
      await this.#call(candidateResource, { operation: "health" });
      this.state.phase = "committed";
      this.state.probation_previous_revision = null;
      this.state.last_known_good = candidate;
      this.boundary.releaseResource(oldResource);
      this.state.inflight_result = { outcome: "committed", active: candidate, graph_revision: this.state.graph_revision };
      await this.#persist("graph-committed", { slot: inactive, identity: bundle.identity });
      return this.state.inflight_result;
    } catch (error) {
      if (this.activeResource === candidateResource) {
        this.activeResource = oldResource;
        this.state.active = oldActive;
        this.state.graph_revision = oldRevision;
        this.state.phase = "committed";
        this.state.probation_previous_revision = null;
        this.state.last_known_good = oldActive;
        this.state.rollback_count += 1;
        this.state.inflight_result = { outcome: "rolled-back", active: oldActive, graph_revision: oldRevision, error: error.message };
        await this.#persist("graph-rolled-back", { failed_identity: bundle.identity, error: error.message });
      }
      this.boundary.releaseResource(candidateResource);
      return this.state.inflight_result ?? { outcome: "rolled-back", active: oldActive, graph_revision: oldRevision, error: error.message };
    }
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

  async #installProbed(root) {
    const resource = await this.boundary.install(root);
    try {
      await this.#call(resource, { operation: "probe" });
      return resource;
    } catch (error) {
      this.boundary.releaseResource(resource);
      throw error;
    }
  }

  #rootFor(locator) {
    if (locator.kind === "factory") return this.factoryRoot;
    if (locator.kind === "slot" && (locator.slot === "A" || locator.slot === "B")) {
      return path.join(this.stateRoot, "slots", locator.slot);
    }
    throw new Error("invalid active graph locator");
  }

  async #packageIdentity(root) {
    const descriptor = JSON.parse(await readFile(path.join(root, "native-boundary.json"), "utf8"));
    if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1" || typeof descriptor.identity !== "string") {
      throw new Error("invalid exact Lib descriptor");
    }
    return descriptor.identity;
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
