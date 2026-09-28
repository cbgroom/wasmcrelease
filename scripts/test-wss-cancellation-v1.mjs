import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { connectWss } from "../runtime/client-foundation-v1/wss-transport.mjs";

const cert = readFileSync(path.join(process.cwd(), "scripts/fixtures/ios-wss-cert.pem"));

const alreadyAborted = new AbortController();
alreadyAborted.abort();
await assert.rejects(connectWss("wss://localhost:1/control", { ca: cert, signal: alreadyAborted.signal }), /connection aborted/);

const sockets = new Set();
const stalled = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});
await new Promise((resolve, reject) => {
  stalled.once("error", reject);
  stalled.listen(0, "127.0.0.1", resolve);
});
const controller = new AbortController();
const connecting = connectWss(`wss://localhost:${stalled.address().port}/control`, { ca: cert, signal: controller.signal });
setTimeout(() => controller.abort(), 10);
await assert.rejects(connecting, /connection aborted/);
const socketClosures = [...sockets].map((socket) => once(socket, "close"));
for (const socket of sockets) socket.destroy();
await Promise.all(socketClosures);
await new Promise((resolve, reject) => stalled.close((error) => error ? reject(error) : resolve()));

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.client-foundation-wss-cancellation/v1",
  preconnect_abort: true,
  tls_handshake_abort: true,
  leaked_server_sockets: sockets.size,
}));
