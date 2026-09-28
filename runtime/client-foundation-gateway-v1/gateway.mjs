import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { encodeFrame, FrameDecoder } from "../client-foundation-v1/websocket-wire.mjs";

const STATE_SCHEMA = "wasmc.client-foundation-gateway-state/v1";
const BUNDLE_SCHEMA = "wasmc.client-foundation-bundle/v1";
const CONTROL_SCHEMA = "wasmc.client-foundation-control/v1";
const ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const ALLOWED_BUNDLE_FILES = new Set(["lib.wit", "native-boundary.json", "native-adapter.mjs"]);
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
  for (const file of bundle.files) {
    if (!ALLOWED_BUNDLE_FILES.has(file.path) || seen.has(file.path) || typeof file.sha256 !== "string" || typeof file.base64 !== "string") {
      throw new Error("invalid bundle file declaration");
    }
    const decoded = Buffer.from(file.base64, "base64");
    if (sha256(decoded) !== file.sha256) throw new Error(`bundle file identity mismatch: ${file.path}`);
    seen.add(file.path);
  }
  if (![...ALLOWED_BUNDLE_FILES].every((name) => seen.has(name))) throw new Error("incomplete Client Foundation bundle");
  const descriptorFile = bundle.files.find((file) => file.path === "native-boundary.json");
  const descriptor = JSON.parse(Buffer.from(descriptorFile.base64, "base64").toString("utf8"));
  if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1" || descriptor.identity !== bundle.identity) {
    throw new Error("bundle descriptor identity mismatch");
  }
  return bundle;
}

export class ClientFoundationGateway {
  constructor({ dataRoot, tlsKey, tlsCert, host = "127.0.0.1", port = 0, advertiseOrigin = null } = {}) {
    if (!dataRoot || !tlsKey || !tlsCert) throw new Error("incomplete Client Foundation Gateway configuration");
    this.dataRoot = path.resolve(dataRoot);
    this.statePath = path.join(this.dataRoot, "state.json");
    this.artifactRoot = path.join(this.dataRoot, "artifacts");
    this.tlsKey = tlsKey;
    this.tlsCert = tlsCert;
    this.host = host;
    this.port = port;
    this.advertiseOrigin = advertiseOrigin;
    this.state = null;
    this.server = null;
    this.connections = new Map();
    this.persistChain = Promise.resolve();
  }

  async start() {
    if (this.server) throw new Error("gateway already started");
    await mkdir(this.artifactRoot, { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (this.state.schema !== STATE_SCHEMA) throw new Error("unsupported gateway state");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = { schema: STATE_SCHEMA, artifacts: {}, clients: {} };
      await this.#persist();
    }
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
    if (!this.server) return;
    for (const connection of this.connections.values()) connection.socket.destroy();
    this.connections.clear();
    this.server.closeAllConnections();
    const server = this.server;
    this.server = null;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await this.persistChain;
  }

  async #handleHttp(request, response) {
    const url = new URL(request.url, this.advertiseOrigin ?? "https://localhost");
    if (request.method === "GET" && url.pathname === "/healthz") {
      jsonResponse(response, 200, { accepted: true, schema: "wasmc.client-foundation-gateway-health/v1" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/artifacts") {
      const bytes = await readBody(request);
      const bundle = validateBundle(bytes);
      const digest = sha256(bytes);
      const artifactPath = path.join(this.artifactRoot, `${digest}.json`);
      try {
        await writeFile(artifactPath, bytes, { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST" || sha256(await readFile(artifactPath)) !== digest) throw error;
      }
      this.state.artifacts[digest] = { sha256: digest, bytes: bytes.length, identity: bundle.identity };
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
      jsonResponse(response, 200, { accepted: true, client_id: clientId, connected: this.connections.has(clientId), ...client });
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
      const existing = client.commands.find((command) => command.message_id === input.message_id);
      if (existing) {
        if (existing.operation !== input.operation || JSON.stringify(existing.request_payload) !== JSON.stringify(input.payload ?? {})) {
          return jsonResponse(response, 409, { accepted: false, error: "message identity conflict" });
        }
        jsonResponse(response, 200, { accepted: true, duplicate: true, command: existing });
        return;
      }
      const payload = structuredClone(input.payload ?? {});
      if (input.operation === "graph.apply" && typeof payload.artifact_sha256 === "string") {
        if (!this.state.artifacts[payload.artifact_sha256]) throw new Error("unknown graph artifact");
        payload.artifact_url = `${this.advertiseOrigin}/v1/artifacts/${payload.artifact_sha256}`;
      }
      const command = {
        message_id: input.message_id,
        sequence: client.next_sequence,
        operation: input.operation,
        request_payload: structuredClone(input.payload ?? {}),
        payload,
        status: "queued",
        receipt: null,
      };
      client.next_sequence += 1;
      client.commands.push(command);
      await this.#persist();
      await this.#dispatch(clientId);
      jsonResponse(response, 201, { accepted: true, duplicate: false, command });
      return;
    }
    jsonResponse(response, 404, { accepted: false, error: "route not found" });
  }

  #handleUpgrade(request, socket) {
    try {
      const url = new URL(request.url, this.advertiseOrigin ?? "https://localhost");
      const match = url.pathname.match(/^\/v1\/clients\/([^/]+)\/control$/);
      const clientId = match ? decodeURIComponent(match[1]) : null;
      if (!validClientId(clientId)) throw new Error("invalid control client identity");
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string") throw new Error("missing WebSocket key");
      const accept = createHash("sha1").update(key + ACCEPT_GUID).digest("base64");
      socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "", ""].join("\r\n"));
      this.connections.get(clientId)?.socket.destroy();
      const connection = { socket, decoder: new FrameDecoder({ expectMasked: true }), hello: false, chain: Promise.resolve() };
      this.connections.set(clientId, connection);
      socket.on("data", (chunk) => this.#handleFrames(clientId, connection, chunk));
      socket.on("close", () => { if (this.connections.get(clientId) === connection) this.connections.delete(clientId); });
      socket.on("error", () => { if (this.connections.get(clientId) === connection) this.connections.delete(clientId); });
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
    if (command.receipt && JSON.stringify(command.receipt) !== JSON.stringify(message)) throw new Error("receipt replay mismatch");
    command.receipt = message;
    command.status = "completed";
    await this.#persist();
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
    this.state.clients[clientId] ??= { next_sequence: 1, last_hello: null, commands: [] };
    return this.state.clients[clientId];
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
