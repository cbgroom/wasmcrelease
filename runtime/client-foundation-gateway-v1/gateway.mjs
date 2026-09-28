import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { encodeFrame, FrameDecoder } from "../client-foundation-v1/websocket-wire.mjs";
import { canonicalJson, canonicalJsonSha256, describeDynamicLibDag, describeSerialLibGraph, identifyDynamicLibPackageFiles } from "../client-foundation-v1/dynamic-lib-graph-spec.mjs";
import { validateWitPortManifest } from "../client-foundation-v1/wit-port-contracts.mjs";

const STATE_SCHEMA = "wasmc.client-foundation-gateway-state/v1";
const BUNDLE_SCHEMA = "wasmc.client-foundation-bundle/v1";
const CONTROL_SCHEMA = "wasmc.client-foundation-control/v1";
const ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const REQUIRED_BUNDLE_FILES = new Set(["lib.wit", "native-boundary.json", "native-adapter.mjs"]);
const ALLOWED_BUNDLE_FILES = new Set([...REQUIRED_BUNDLE_FILES, "graph-ports.json"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const validClientId = (value) => typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
const jsonResponse = (response, status, value) => {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { "content-type": "application/json", "content-length": body.length, "cache-control": "no-store" });
  response.end(body);
};

async function readBody(request, maxBytes = MAX_JSON_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("request body limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validateBundle(bytes) {
  const bundle = JSON.parse(bytes.toString("utf8"));
  if (bundle.schema !== BUNDLE_SCHEMA || typeof bundle.identity !== "string" || !Array.isArray(bundle.files)) {
    throw new Error("invalid Client Foundation bundle");
  }
  const seen = new Set();
  const entries = [];
  for (const file of bundle.files) {
    if (!ALLOWED_BUNDLE_FILES.has(file.path) || seen.has(file.path) || typeof file.sha256 !== "string" || typeof file.base64 !== "string") {
      throw new Error("invalid bundle file declaration");
    }
    const decoded = Buffer.from(file.base64, "base64");
    if (sha256(decoded) !== file.sha256) throw new Error(`bundle file identity mismatch: ${file.path}`);
    seen.add(file.path);
    entries.push({ path: file.path, bytes: decoded });
  }
  if (![...REQUIRED_BUNDLE_FILES].every((name) => seen.has(name))) throw new Error("incomplete Client Foundation bundle");
  const exact = identifyDynamicLibPackageFiles(entries);
  if (exact.graph_ports) validateWitPortManifest(exact.graph_ports, entries.find((entry) => entry.path === exact.descriptor.wit).bytes);
  if (exact.identity !== bundle.identity) throw new Error("bundle descriptor identity mismatch");
  return { bundle, exact };
}

export class ClientFoundationGateway {
  constructor({
    dataRoot,
    tlsKey,
    tlsCert,
    host = "127.0.0.1",
    port = 0,
    advertiseOrigin = null,
    maxCompletedCommandsPerClient = 128,
    maxArchiveSegmentsPerClient = 16,
    heartbeatIntervalMs = 30000,
    heartbeatTimeoutMs = 90000,
  } = {}) {
    if (!dataRoot || !tlsKey || !tlsCert) throw new Error("incomplete Client Foundation Gateway configuration");
    if (!Number.isSafeInteger(maxCompletedCommandsPerClient) || maxCompletedCommandsPerClient < 1) throw new Error("invalid completed-command retention");
    if (!Number.isSafeInteger(maxArchiveSegmentsPerClient) || maxArchiveSegmentsPerClient < 2) throw new Error("invalid archive segment retention");
    if (!Number.isSafeInteger(heartbeatIntervalMs) || heartbeatIntervalMs < 1 || !Number.isSafeInteger(heartbeatTimeoutMs) || heartbeatTimeoutMs <= heartbeatIntervalMs) {
      throw new Error("heartbeat timeout must exceed its positive interval");
    }
    this.dataRoot = path.resolve(dataRoot);
    this.statePath = path.join(this.dataRoot, "state.json");
    this.artifactRoot = path.join(this.dataRoot, "artifacts");
    this.archiveRoot = path.join(this.dataRoot, "archives");
    this.lockPath = path.join(this.dataRoot, ".gateway.lock");
    this.tlsKey = tlsKey;
    this.tlsCert = tlsCert;
    this.host = host;
    this.port = port;
    this.advertiseOrigin = advertiseOrigin;
    this.maxCompletedCommandsPerClient = maxCompletedCommandsPerClient;
    this.maxArchiveSegmentsPerClient = maxArchiveSegmentsPerClient;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.state = null;
    this.server = null;
    this.connections = new Map();
    this.receiptWaiters = new Map();
    this.persistChain = Promise.resolve();
    this.lockToken = null;
    this.closing = false;
  }

  async start() {
    if (this.server) throw new Error("gateway already started");
    this.closing = false;
    await mkdir(this.artifactRoot, { recursive: true });
    await mkdir(this.archiveRoot, { recursive: true });
    await this.#acquireLock();
    try {
      try {
        this.state = JSON.parse(await readFile(this.statePath, "utf8"));
        if (this.state.schema !== STATE_SCHEMA) throw new Error("unsupported gateway state");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        this.state = { schema: STATE_SCHEMA, artifacts: {}, clients: {} };
        await this.#persist();
      }
      await this.#verifyDurableState();
      await this.#collectArchiveGarbage();
      this.server = https.createServer({ key: this.tlsKey, cert: this.tlsCert }, (request, response) => {
        this.#handleHttp(request, response).catch((error) => jsonResponse(response, 400, { accepted: false, error: error.message }));
      });
      this.server.on("upgrade", (request, socket) => this.#handleUpgrade(request, socket));
      await new Promise((resolve, reject) => {
        this.server.once("error", reject);
        this.server.listen(this.port, this.host, resolve);
      });
      if (!this.advertiseOrigin) this.advertiseOrigin = `https://localhost:${this.server.address().port}`;
      return this.address();
    } catch (error) {
      await this.#releaseLock();
      throw error;
    }
  }

  address() {
    if (!this.server) return null;
    return {
      host: this.host,
      port: this.server.address().port,
      origin: this.advertiseOrigin,
      wss_base: this.advertiseOrigin.replace(/^https:/, "wss:"),
    };
  }

  async close() {
    if (!this.server) {
      await this.#releaseLock();
      return;
    }
    this.closing = true;
    const server = this.server;
    this.server = null;
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const connection of this.connections.values()) {
      clearInterval(connection.heartbeatTimer);
      connection.socket.destroy();
    }
    this.connections.clear();
    for (const waiters of this.receiptWaiters.values()) for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.receiptWaiters.clear();
    server.closeAllConnections();
    try {
      await closed;
      await this.persistChain;
    } finally {
      await this.#releaseLock();
      this.closing = false;
    }
  }

  async #handleHttp(request, response) {
    const url = new URL(request.url, this.advertiseOrigin ?? "https://localhost");
    if (request.method === "GET" && url.pathname === "/healthz") {
      jsonResponse(response, 200, { accepted: true, schema: "wasmc.client-foundation-gateway-health/v1" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/artifacts") {
      const bytes = await readBody(request);
      const validated = validateBundle(bytes);
      const digest = sha256(bytes);
      const artifactPath = path.join(this.artifactRoot, `${digest}.json`);
      try {
        await writeFile(artifactPath, bytes, { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST" || sha256(await readFile(artifactPath)) !== digest) throw error;
      }
      this.state.artifacts[digest] = {
        sha256: digest,
        bytes: bytes.length,
        identity: validated.exact.identity,
        package_sha256: validated.exact.artifact_sha256,
        wit_contract_sha256: validated.exact.wit_contract_sha256,
        port_contracts: validated.exact.graph_ports ? { inputs: validated.exact.graph_ports.inputs, outputs: validated.exact.graph_ports.outputs } : null,
        port_contracts_sha256: validated.exact.graph_ports ? canonicalJsonSha256({ inputs: validated.exact.graph_ports.inputs, outputs: validated.exact.graph_ports.outputs }) : null,
        state_policy: validated.exact.descriptor.state?.policy ?? "stateless",
        state_schema_identity: validated.exact.descriptor.state?.schema_identity ?? null,
      };
      await this.#persist();
      jsonResponse(response, 201, { accepted: true, ...this.state.artifacts[digest], url: `${this.advertiseOrigin}/v1/artifacts/${digest}` });
      return;
    }
    const artifactMatch = url.pathname.match(/^\/v1\/artifacts\/([a-f0-9]{64})$/);
    if (request.method === "GET" && artifactMatch) {
      const digest = artifactMatch[1];
      const metadata = this.state.artifacts[digest];
      if (!metadata) return jsonResponse(response, 404, { accepted: false, error: "artifact not found" });
      const bytes = await readFile(path.join(this.artifactRoot, `${digest}.json`));
      if (sha256(bytes) !== digest) throw new Error("stored artifact identity mismatch");
      response.writeHead(200, { "content-type": "application/json", "content-length": bytes.length, "cache-control": "public, immutable" });
      response.end(bytes);
      return;
    }
    const clientMatch = url.pathname.match(/^\/v1\/clients\/([^/]+)$/);
    if (request.method === "GET" && clientMatch) {
      const clientId = decodeURIComponent(clientMatch[1]);
      if (!validClientId(clientId)) throw new Error("invalid client identity");
      const client = this.#client(clientId);
      const connection = this.connections.get(clientId);
      jsonResponse(response, 200, {
        accepted: true,
        client_id: clientId,
        connected: Boolean(connection),
        connection: connection ? { last_pong_at: connection.lastPongAt, pongs: connection.pongs } : null,
        ...client,
      });
      return;
    }
    const receiptMatch = url.pathname.match(/^\/v1\/clients\/([^/]+)\/commands\/([^/]+)$/);
    if (request.method === "GET" && receiptMatch) {
      const clientId = decodeURIComponent(receiptMatch[1]);
      const messageId = decodeURIComponent(receiptMatch[2]);
      if (!validClientId(clientId) || !messageId || messageId.length > 256) throw new Error("invalid command identity");
      const waitMs = Math.min(30000, Math.max(0, Number(url.searchParams.get("wait_ms") ?? 0)));
      const command = await this.#waitForCommand(clientId, messageId, waitMs);
      jsonResponse(response, command?.receipt ? 200 : 202, { accepted: true, command });
      return;
    }
    const commandMatch = url.pathname.match(/^\/v1\/clients\/([^/]+)\/commands$/);
    if (request.method === "POST" && commandMatch) {
      const clientId = decodeURIComponent(commandMatch[1]);
      if (!validClientId(clientId)) throw new Error("invalid client identity");
      const input = JSON.parse((await readBody(request, 256 * 1024)).toString("utf8"));
      if (typeof input.message_id !== "string" || !input.message_id || typeof input.operation !== "string") {
        throw new Error("command requires message_id and operation");
      }
      const client = this.#client(clientId);
      const requestPayload = structuredClone(input.payload ?? {});
      const fingerprint = sha256(Buffer.from(canonicalJson({ operation: input.operation, payload: requestPayload })));
      const indexed = client.message_index[input.message_id];
      if (indexed) {
        if (indexed.fingerprint !== fingerprint) {
          return jsonResponse(response, 409, { accepted: false, error: "message identity conflict" });
        }
        const existing = client.commands.find((command) => command.message_id === input.message_id);
        jsonResponse(response, 200, { accepted: true, duplicate: true, command: existing ?? { ...indexed, message_id: input.message_id, status: "archived" } });
        return;
      }
      const archived = await this.#findArchivedCommand(clientId, client, input.message_id);
      if (archived) {
        const archivedFingerprint = sha256(Buffer.from(canonicalJson({ operation: archived.operation, payload: archived.request_payload ?? {} })));
        if (archivedFingerprint !== fingerprint) {
          return jsonResponse(response, 409, { accepted: false, error: "message identity conflict" });
        }
        jsonResponse(response, 200, {
          accepted: true,
          duplicate: true,
          command: { message_id: archived.message_id, sequence: archived.sequence, operation: archived.operation, status: "archived" },
        });
        return;
      }
      const payload = structuredClone(requestPayload);
      if (input.operation === "graph.apply" && typeof payload.artifact_sha256 === "string") {
        if (!this.state.artifacts[payload.artifact_sha256]) throw new Error("unknown graph artifact");
        payload.artifact_url = `${this.advertiseOrigin}/v1/artifacts/${payload.artifact_sha256}`;
      }
      if (input.operation === "lib-graph.apply") {
        const dag = Array.isArray(payload.edges) || payload.entrypoint !== undefined;
        if (!Array.isArray(payload.blocks) || (!dag && !Array.isArray(payload.pipeline)) || typeof payload.graph_digest !== "string") throw new Error("incomplete dynamic Lib graph command");
        const graphBlocks = payload.blocks.map((block) => {
          const metadata = this.state.artifacts[block.bundle_sha256];
          if (!metadata) throw new Error(`unknown dynamic Lib bundle: ${block.name}`);
          if (metadata.identity !== block.identity || metadata.package_sha256 !== block.artifact_sha256 || metadata.wit_contract_sha256 !== block.wit_contract_sha256) {
            throw new Error(`dynamic Lib bundle declaration mismatch: ${block.name}`);
          }
          if (metadata.state_policy !== block.state_policy || metadata.state_schema_identity !== block.state_schema_identity) {
            throw new Error(`dynamic Lib bundle state declaration mismatch: ${block.name}`);
          }
          if (dag && (canonicalJson(metadata.port_contracts) !== canonicalJson(block.port_contracts) || metadata.port_contracts_sha256 !== block.port_contracts_sha256)) {
            throw new Error(`dynamic Lib bundle port declaration mismatch: ${block.name}`);
          }
          return { ...block, root: "gateway-verified-content-addressed-locator" };
        });
        const described = dag
          ? describeDynamicLibDag({ blocks: graphBlocks, edges: payload.edges, entrypoint: payload.entrypoint })
          : describeSerialLibGraph({ blocks: graphBlocks, pipeline: payload.pipeline });
        if (described.graph_digest !== payload.graph_digest) throw new Error("dynamic Lib graph command digest mismatch");
        payload.blocks = payload.blocks.map((block) => ({ ...block, artifact_url: `${this.advertiseOrigin}/v1/artifacts/${block.bundle_sha256}` }));
      }
      const command = {
        message_id: input.message_id,
        sequence: client.next_sequence,
        operation: input.operation,
        request_payload: requestPayload,
        payload,
        status: "queued",
        receipt: null,
      };
      client.next_sequence += 1;
      client.commands.push(command);
      client.message_index[input.message_id] = { sequence: command.sequence, operation: command.operation, fingerprint };
      await this.#persist();
      await this.#dispatch(clientId);
      jsonResponse(response, 201, { accepted: true, duplicate: false, command });
      return;
    }
    jsonResponse(response, 404, { accepted: false, error: "route not found" });
  }

  #handleUpgrade(request, socket) {
    try {
      if (this.closing || !this.server) throw new Error("gateway closing");
      const url = new URL(request.url, this.advertiseOrigin ?? "https://localhost");
      const match = url.pathname.match(/^\/v1\/clients\/([^/]+)\/control$/);
      const clientId = match ? decodeURIComponent(match[1]) : null;
      if (!validClientId(clientId)) throw new Error("invalid control client identity");
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string") throw new Error("missing WebSocket key");
      const accept = createHash("sha1").update(key + ACCEPT_GUID).digest("base64");
      socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "", ""].join("\r\n"));
      this.connections.get(clientId)?.socket.destroy();
      const connection = {
        socket,
        decoder: new FrameDecoder({ expectMasked: true }),
        hello: false,
        chain: Promise.resolve(),
        lastPongAt: Date.now(),
        pongs: 0,
        heartbeatTimer: null,
      };
      connection.heartbeatTimer = setInterval(() => {
        if (Date.now() - connection.lastPongAt > this.heartbeatTimeoutMs) {
          connection.socket.destroy();
          return;
        }
        if (!connection.socket.destroyed) connection.socket.write(encodeFrame(String(Date.now()), { opcode: 0x9 }));
      }, this.heartbeatIntervalMs);
      connection.heartbeatTimer.unref?.();
      this.connections.set(clientId, connection);
      socket.on("data", (chunk) => this.#handleFrames(clientId, connection, chunk));
      const cleanup = () => {
        clearInterval(connection.heartbeatTimer);
        if (this.connections.get(clientId) === connection) this.connections.delete(clientId);
      };
      socket.on("close", cleanup);
      socket.on("error", cleanup);
    } catch {
      socket.destroy();
    }
  }

  #handleFrames(clientId, connection, chunk) {
    try {
      for (const frame of connection.decoder.push(chunk)) {
        if (frame.opcode === 0x8) return connection.socket.end(encodeFrame(frame.payload, { opcode: 0x8 }));
        if (frame.opcode === 0x9) {
          connection.socket.write(encodeFrame(frame.payload, { opcode: 0xa }));
          continue;
        }
        if (frame.opcode === 0xa) {
          connection.lastPongAt = Date.now();
          connection.pongs += 1;
          continue;
        }
        if (frame.opcode !== 0x1) throw new Error("unsupported WebSocket client frame");
        const message = JSON.parse(frame.payload.toString("utf8"));
        connection.chain = connection.chain
          .then(() => this.#handleControlMessage(clientId, connection, message))
          .catch(() => connection.socket.destroy());
      }
    } catch {
      connection.socket.destroy();
    }
  }

  async #handleControlMessage(clientId, connection, message) {
    const client = this.#client(clientId);
    if (message.type === "hello") {
      if (message.schema !== CONTROL_SCHEMA || !Number.isSafeInteger(message.last_server_sequence) || !Number.isSafeInteger(message.graph_revision)) {
        throw new Error("invalid client hello");
      }
      const checkpoint = message.state_checkpoint;
      if (checkpoint !== null && checkpoint !== undefined && (
        checkpoint.schema !== "wasmc.dynamic-lib-state-checkpoint/v1" ||
        checkpoint.graph_revision !== message.graph_revision ||
        checkpoint.graph_digest !== message.graph_digest ||
        !/^[a-f0-9]{64}$/.test(checkpoint.checkpoint_sha256 ?? "") ||
        !Number.isSafeInteger(checkpoint.state_blocks) || checkpoint.state_blocks < 1
      )) throw new Error("invalid client state checkpoint summary");
      connection.hello = true;
      client.last_hello = message;
      await this.#persist();
      await this.#dispatch(clientId);
      return;
    }
    if (!connection.hello || message.type !== "receipt" || typeof message.message_id !== "string" || !Number.isSafeInteger(message.sequence)) {
      throw new Error("invalid client receipt");
    }
    const command = client.commands.find((candidate) => candidate.message_id === message.message_id);
    if (!command || command.sequence !== message.sequence) throw new Error("receipt command identity mismatch");
    if (command.receipt && canonicalJson(command.receipt) !== canonicalJson(message)) throw new Error("receipt replay mismatch");
    command.receipt = message;
    command.status = "completed";
    await this.#compact(clientId, client);
    await this.#persist();
    await this.#collectArchiveGarbage();
    this.#notifyReceipt(clientId, command);
    await this.#dispatch(clientId);
  }

  async #dispatch(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection?.hello || connection.socket.destroyed) return;
    const client = this.#client(clientId);
    const pending = client.commands.find((command) => !command.receipt);
    if (!pending) return;
    pending.status = "delivered";
    await this.#persist();
    connection.socket.write(encodeFrame(JSON.stringify({
      type: "command",
      message_id: pending.message_id,
      sequence: pending.sequence,
      operation: pending.operation,
      payload: pending.payload,
    })));
  }

  #client(clientId) {
    this.state.clients[clientId] ??= {
      next_sequence: 1,
      last_hello: null,
      commands: [],
      message_index: {},
      archives: [],
      compacted_through_sequence: 0,
    };
    const client = this.state.clients[clientId];
    client.message_index ??= {};
    client.archives ??= [];
    client.compacted_through_sequence ??= 0;
    for (const command of client.commands) {
      client.message_index[command.message_id] ??= {
        sequence: command.sequence,
        operation: command.operation,
        fingerprint: sha256(Buffer.from(canonicalJson({ operation: command.operation, payload: command.request_payload ?? {} }))),
      };
    }
    return client;
  }

  async #compact(clientId, client) {
    const limit = this.maxCompletedCommandsPerClient;
    if (!Number.isSafeInteger(limit) || limit < 1 || client.commands.length <= limit * 2) return;
    const eligible = client.commands.slice(0, limit);
    if (eligible.some((command) => !command.receipt)) return;
    const bytes = Buffer.from(`${eligible.map((command) => JSON.stringify(command)).join("\n")}\n`);
    const digest = sha256(bytes);
    const from = eligible[0].sequence;
    const through = eligible.at(-1).sequence;
    const directory = path.join(this.archiveRoot, clientId);
    await mkdir(directory, { recursive: true });
    const filename = `${from}-${through}-${digest}.jsonl`;
    const archivePath = path.join(directory, filename);
    try {
      await writeFile(archivePath, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST" || sha256(await readFile(archivePath)) !== digest) throw error;
    }
    client.commands.splice(0, eligible.length);
    for (const command of eligible) delete client.message_index[command.message_id];
    client.compacted_through_sequence = through;
    client.archives.push({ from_sequence: from, through_sequence: through, commands: eligible.length, sha256: digest, path: `${clientId}/${filename}` });
    if (client.archives.length > this.maxArchiveSegmentsPerClient * 2) {
      await this.#mergeArchiveSegments(clientId, client);
    }
  }

  async #mergeArchiveSegments(clientId, client) {
    const mergeCount = this.maxArchiveSegmentsPerClient + 1;
    const segments = client.archives.slice(0, mergeCount);
    const chunks = [];
    for (const segment of segments) {
      const bytes = await readFile(this.#archivePath(clientId, segment));
      if (sha256(bytes) !== segment.sha256) throw new Error("archive identity mismatch before merge");
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks);
    const digest = sha256(bytes);
    const from = segments[0].from_sequence;
    const through = segments.at(-1).through_sequence;
    const commands = segments.reduce((sum, segment) => sum + segment.commands, 0);
    const directory = path.join(this.archiveRoot, clientId);
    const filename = `${from}-${through}-${digest}.jsonl`;
    const mergedPath = path.join(directory, filename);
    try {
      await writeFile(mergedPath, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST" || sha256(await readFile(mergedPath)) !== digest) throw error;
    }
    client.archives.splice(0, mergeCount, {
      from_sequence: from,
      through_sequence: through,
      commands,
      sha256: digest,
      path: `${clientId}/${filename}`,
    });
  }

  async #collectArchiveGarbage() {
    const referenced = new Set();
    for (const [clientId, client] of Object.entries(this.state.clients)) {
      for (const archive of this.#client(clientId).archives) referenced.add(archive.path);
    }
    let directories = [];
    try { directories = await readdir(this.archiveRoot, { withFileTypes: true }); } catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const directory of directories) {
      if (!directory.isDirectory() || !validClientId(directory.name)) continue;
      const files = await readdir(path.join(this.archiveRoot, directory.name), { withFileTypes: true });
      for (const file of files) {
        const relative = `${directory.name}/${file.name}`;
        if (file.isFile() && file.name.endsWith(".jsonl") && !referenced.has(relative)) {
          await unlink(path.join(this.archiveRoot, relative));
        }
      }
    }
  }

  async #findArchivedCommand(clientId, client, messageId) {
    for (const archive of [...client.archives].reverse()) {
      const bytes = await readFile(this.#archivePath(clientId, archive));
      if (sha256(bytes) !== archive.sha256) throw new Error("archive identity mismatch");
      for (const line of bytes.toString("utf8").trim().split("\n")) {
        const command = JSON.parse(line);
        if (command.message_id === messageId) return command;
      }
    }
    return null;
  }

  async #waitForCommand(clientId, messageId, waitMs) {
    const client = this.#client(clientId);
    const active = client.commands.find((command) => command.message_id === messageId);
    if (active?.receipt || waitMs === 0) return active ?? this.#findArchivedCommand(clientId, client, messageId);
    const archived = active ? null : await this.#findArchivedCommand(clientId, client, messageId);
    if (archived) return archived;
    return new Promise((resolve) => {
      const key = `${clientId}\0${messageId}`;
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const list = this.receiptWaiters.get(key) ?? [];
        this.receiptWaiters.set(key, list.filter((candidate) => candidate !== waiter));
        resolve(active ?? null);
      }, waitMs);
      this.receiptWaiters.set(key, [...(this.receiptWaiters.get(key) ?? []), waiter]);
    });
  }

  #notifyReceipt(clientId, command) {
    const key = `${clientId}\0${command.message_id}`;
    const waiters = this.receiptWaiters.get(key) ?? [];
    this.receiptWaiters.delete(key);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(command);
    }
  }

  async #verifyDurableState() {
    if (!this.state.artifacts || typeof this.state.artifacts !== "object" || !this.state.clients || typeof this.state.clients !== "object") {
      throw new Error("invalid gateway state shape");
    }
    let migrated = false;
    for (const [digest, metadata] of Object.entries(this.state.artifacts)) {
      if (!/^[a-f0-9]{64}$/.test(digest) || metadata.sha256 !== digest) throw new Error("invalid artifact metadata identity");
      const bytes = await readFile(path.join(this.artifactRoot, `${digest}.json`));
      if (bytes.length !== metadata.bytes || sha256(bytes) !== digest) throw new Error("stored artifact identity mismatch");
      const validated = validateBundle(bytes);
      if (validated.exact.identity !== metadata.identity) throw new Error("stored artifact provider identity mismatch");
      if (metadata.package_sha256 && metadata.package_sha256 !== validated.exact.artifact_sha256) throw new Error("stored package identity mismatch");
      if (metadata.wit_contract_sha256 && metadata.wit_contract_sha256 !== validated.exact.wit_contract_sha256) throw new Error("stored WIT contract identity mismatch");
      const portContracts = validated.exact.graph_ports ? { inputs: validated.exact.graph_ports.inputs, outputs: validated.exact.graph_ports.outputs } : null;
      const portContractsSha = portContracts ? canonicalJsonSha256(portContracts) : null;
      const statePolicy = validated.exact.descriptor.state?.policy ?? "stateless";
      const stateSchemaIdentity = validated.exact.descriptor.state?.schema_identity ?? null;
      if (metadata.port_contracts && canonicalJson(metadata.port_contracts) !== canonicalJson(portContracts)) throw new Error("stored port contracts mismatch");
      if (metadata.port_contracts_sha256 && metadata.port_contracts_sha256 !== portContractsSha) throw new Error("stored port contract identity mismatch");
      if (metadata.state_policy !== undefined && metadata.state_policy !== statePolicy) throw new Error("stored state policy mismatch");
      if (metadata.state_schema_identity !== undefined && metadata.state_schema_identity !== stateSchemaIdentity) throw new Error("stored state schema identity mismatch");
      if (!metadata.package_sha256 || !metadata.wit_contract_sha256 || (portContracts && !metadata.port_contracts_sha256) || metadata.state_policy === undefined) {
        metadata.package_sha256 = validated.exact.artifact_sha256;
        metadata.wit_contract_sha256 = validated.exact.wit_contract_sha256;
        metadata.port_contracts = portContracts;
        metadata.port_contracts_sha256 = portContractsSha;
        metadata.state_policy = statePolicy;
        metadata.state_schema_identity = stateSchemaIdentity;
        migrated = true;
      }
    }
    for (const [clientId, rawClient] of Object.entries(this.state.clients)) {
      if (!validClientId(clientId) || !rawClient || typeof rawClient !== "object") throw new Error("invalid persisted client identity");
      const client = this.#client(clientId);
      let expectedFrom = 1;
      for (const archive of client.archives) {
        const bytes = await readFile(this.#archivePath(clientId, archive));
        if (!/^[a-f0-9]{64}$/.test(archive.sha256) || sha256(bytes) !== archive.sha256) throw new Error("archive identity mismatch");
        const lines = bytes.toString("utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        if (lines.length !== archive.commands || archive.from_sequence !== expectedFrom || lines[0]?.sequence !== archive.from_sequence || lines.at(-1)?.sequence !== archive.through_sequence) {
          throw new Error("archive sequence metadata mismatch");
        }
        for (let index = 0; index < lines.length; index += 1) {
          if (lines[index].sequence !== archive.from_sequence + index || !lines[index].receipt) throw new Error("invalid archived command sequence");
        }
        expectedFrom = archive.through_sequence + 1;
      }
      const compacted = expectedFrom - 1;
      if (client.compacted_through_sequence !== compacted) throw new Error("compacted sequence watermark mismatch");
      for (let index = 0; index < client.commands.length; index += 1) {
        if (client.commands[index].sequence !== expectedFrom + index) throw new Error("active command sequence gap");
      }
      const nextExpected = expectedFrom + client.commands.length;
      if (client.next_sequence !== nextExpected) throw new Error("next command sequence mismatch");
      for (const [messageId, indexed] of Object.entries(client.message_index)) {
        if (indexed.sequence <= compacted) {
          delete client.message_index[messageId];
          migrated = true;
        }
      }
    }
    if (migrated) await this.#persist();
  }

  #archivePath(clientId, archive) {
    if (typeof archive.path !== "string" || archive.path !== `${clientId}/${path.basename(archive.path)}`) {
      throw new Error("invalid archive path");
    }
    return path.join(this.archiveRoot, archive.path);
  }

  async #acquireLock() {
    const token = randomUUID();
    const record = `${JSON.stringify({ token, pid: process.pid, started_at: new Date().toISOString() })}\n`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await open(this.lockPath, "wx", 0o600);
        await handle.writeFile(record);
        await handle.close();
        this.lockToken = token;
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        let owner;
        try { owner = JSON.parse(await readFile(this.lockPath, "utf8")); } catch { owner = null; }
        let alive = false;
        if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
          try { process.kill(owner.pid, 0); alive = true; } catch (probeError) { alive = probeError.code === "EPERM"; }
        }
        if (alive) throw new Error(`gateway state is already locked by pid ${owner.pid}`);
        await unlink(this.lockPath).catch((unlinkError) => { if (unlinkError.code !== "ENOENT") throw unlinkError; });
      }
    }
    throw new Error("unable to acquire gateway state lock");
  }

  async #releaseLock() {
    if (!this.lockToken) return;
    try {
      const owner = JSON.parse(await readFile(this.lockPath, "utf8"));
      if (owner.token === this.lockToken) await unlink(this.lockPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    } finally {
      this.lockToken = null;
    }
  }

  async #persist() {
    this.persistChain = this.persistChain.then(async () => {
      const next = `${this.statePath}.next`;
      await writeFile(next, `${JSON.stringify(this.state, null, 2)}\n`);
      await rename(next, this.statePath);
    });
    return this.persistChain;
  }
}

export const loadTlsFile = (file) => readFileSync(file);
