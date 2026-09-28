import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFrame, FrameDecoder } from "../../runtime/client-foundation-v1/websocket-wire.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function packageBundle(relativeRoot) {
  const root = path.join(repositoryRoot, relativeRoot);
  const names = ["lib.wit", "native-boundary.json", "native-adapter.mjs"];
  const files = names.map((name) => {
    const bytes = readFileSync(path.join(root, name));
    return { path: name, sha256: sha256(bytes), base64: bytes.toString("base64") };
  });
  const descriptor = JSON.parse(readFileSync(path.join(root, "native-boundary.json"), "utf8"));
  const bytes = Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1",
    identity: descriptor.identity,
    api: "wasmc:client-foundation-block@0.0.1",
    files,
  }));
  return { bytes, sha256: sha256(bytes), identity: descriptor.identity };
}

export async function createClientFoundationGateway() {
  const key = readFileSync(path.join(repositoryRoot, "scripts/fixtures/ios-wss-key.pem"));
  const cert = readFileSync(path.join(repositoryRoot, "scripts/fixtures/ios-wss-cert.pem"));
  const artifacts = {
    "/artifacts/dynamic": packageBundle("runtime/client-foundation-v1/fixtures/dynamic-provider"),
    "/artifacts/broken": packageBundle("runtime/client-foundation-v1/fixtures/broken-provider"),
  };
  const evidence = {
    connections: 0,
    replayed_receipts: 0,
    committed_receipts: 0,
    rolled_back_receipts: 0,
    invoke_receipts: 0,
    hellos: [],
  };
  let doneResolve;
  let doneReject;
  const done = new Promise((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });
  const server = https.createServer({ key, cert }, (request, response) => {
    const artifact = artifacts[new URL(request.url, "https://localhost").pathname];
    if (!artifact) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json",
      "content-length": artifact.bytes.length,
      "cache-control": "no-store",
    });
    response.end(artifact.bytes);
  });
  const sockets = new Set();
  server.on("upgrade", (request, socket) => {
    try {
      const keyHeader = request.headers["sec-websocket-key"];
      if (typeof keyHeader !== "string") throw new Error("missing WebSocket key");
      const accept = createHash("sha1").update(keyHeader + ACCEPT_GUID).digest("base64");
      socket.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "",
        "",
      ].join("\r\n"));
      sockets.add(socket);
      evidence.connections += 1;
      const connectionNumber = evidence.connections;
      const decoder = new FrameDecoder({ expectMasked: true });
      const send = (value) => socket.write(encodeFrame(JSON.stringify(value)));
      socket.on("data", (chunk) => {
        try {
          for (const frame of decoder.push(chunk)) {
            if (frame.opcode === 0x8) {
              socket.end(encodeFrame(frame.payload, { opcode: 0x8 }));
              continue;
            }
            if (frame.opcode === 0x9) {
              socket.write(encodeFrame(frame.payload, { opcode: 0xa }));
              continue;
            }
            if (frame.opcode !== 0x1) throw new Error(`unsupported client opcode ${frame.opcode}`);
            const message = JSON.parse(frame.payload.toString("utf8"));
            if (message.type === "hello") {
              evidence.hellos.push(message);
              if (connectionNumber === 1) {
                if (message.graph_revision !== 1 || message.last_server_sequence !== 0) throw new Error("invalid initial hello");
                send({ type: "command", message_id: "m1", sequence: 1, operation: "inventory.report" });
              } else if (connectionNumber === 2) {
                if (message.graph_revision !== 2 || message.last_server_sequence !== 2) throw new Error("reconnect did not preserve committed state");
                send({
                  type: "command",
                  message_id: "m2",
                  sequence: 2,
                  operation: "graph.apply",
                  payload: {
                    expected_graph_revision: 1,
                    artifact_url: `https://localhost:${server.address().port}/artifacts/dynamic`,
                    artifact_sha256: artifacts["/artifacts/dynamic"].sha256,
                  },
                });
              } else {
                throw new Error("unexpected extra reconnect");
              }
              continue;
            }
            if (message.type !== "receipt") throw new Error("unexpected control message");
            if (message.message_id === "m1") {
              if (message.outcome !== "reported") throw new Error("inventory receipt failed");
              send({
                type: "command",
                message_id: "m2",
                sequence: 2,
                operation: "graph.apply",
                payload: {
                  expected_graph_revision: 1,
                  artifact_url: `https://localhost:${server.address().port}/artifacts/dynamic`,
                  artifact_sha256: artifacts["/artifacts/dynamic"].sha256,
                },
              });
            } else if (message.message_id === "m2" && connectionNumber === 1) {
              if (message.outcome !== "committed" || message.graph_revision !== 2) throw new Error("dynamic graph did not commit");
              evidence.committed_receipts += 1;
              socket.destroy();
            } else if (message.message_id === "m2" && connectionNumber === 2) {
              if (message.replayed !== true || message.outcome !== "committed") throw new Error("duplicate graph command was not replayed");
              evidence.replayed_receipts += 1;
              send({
                type: "command",
                message_id: "m3",
                sequence: 3,
                operation: "graph.apply",
                payload: {
                  expected_graph_revision: 2,
                  artifact_url: `https://localhost:${server.address().port}/artifacts/broken`,
                  artifact_sha256: artifacts["/artifacts/broken"].sha256,
                },
              });
            } else if (message.message_id === "m3") {
              if (message.outcome !== "rolled-back" || message.graph_revision !== 2 || message.active.identity !== artifacts["/artifacts/dynamic"].identity) {
                throw new Error("broken graph did not roll back");
              }
              evidence.rolled_back_receipts += 1;
              send({ type: "command", message_id: "m4", sequence: 4, operation: "invoke", payload: { value: "gateway-check" } });
            } else if (message.message_id === "m4") {
              if (message.outcome !== "completed" || message.response.value !== "dynamic:gateway-check") throw new Error("active graph invocation failed");
              evidence.invoke_receipts += 1;
              doneResolve(evidence);
            } else {
              throw new Error(`unexpected receipt ${JSON.stringify(message)}`);
            }
          }
        } catch (error) {
          doneReject(error);
          socket.destroy();
        }
      });
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", (error) => doneReject(error));
    } catch (error) {
      doneReject(error);
      socket.destroy();
    }
  });
  server.on("error", doneReject);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    url: `wss://localhost:${port}/control`,
    ca: cert,
    done,
    evidence,
    artifacts,
    async close() {
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
