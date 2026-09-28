import { createHash, randomBytes } from "node:crypto";
import { EventEmitter, once } from "node:events";
import tls from "node:tls";
import { encodeFrame, FrameDecoder } from "./websocket-wire.mjs";

const ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export async function connectWss(address, { ca, maxPayload = 1024 * 1024 } = {}) {
  const url = new URL(address);
  if (url.protocol !== "wss:") throw new Error("Client Foundation control URL must use wss");
  const port = Number(url.port || 443);
  const socket = tls.connect({
    host: url.hostname,
    port,
    servername: url.hostname,
    ca,
    rejectUnauthorized: true,
  });
  await once(socket, "secureConnect");
  const key = randomBytes(16).toString("base64");
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  socket.write([
    `GET ${url.pathname}${url.search} HTTP/1.1`,
    `Host: ${host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n"));

  let handshake = Buffer.alloc(0);
  while (!handshake.includes("\r\n\r\n")) {
    const [chunk] = await once(socket, "data");
    handshake = Buffer.concat([handshake, chunk]);
    if (handshake.length > 65536) throw new Error("oversized WebSocket handshake");
  }
  const boundary = handshake.indexOf("\r\n\r\n");
  const headersText = handshake.subarray(0, boundary).toString("latin1");
  const remainder = handshake.subarray(boundary + 4);
  const lines = headersText.split("\r\n");
  if (!/^HTTP\/1\.1 101\b/.test(lines.shift() ?? "")) throw new Error("WebSocket upgrade rejected");
  const headers = new Map(lines.map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
  }));
  const expected = createHash("sha1").update(key + ACCEPT_GUID).digest("base64");
  if (headers.get("sec-websocket-accept") !== expected) throw new Error("invalid WebSocket accept identity");

  const connection = new EventEmitter();
  const decoder = new FrameDecoder({ expectMasked: false, maxPayload });
  let closed = false;
  let closing = false;
  const processChunk = (chunk) => {
    try {
      for (const frame of decoder.push(chunk)) {
        if (frame.opcode === 0x1) connection.emit("message", JSON.parse(frame.payload.toString("utf8")));
        else if (frame.opcode === 0x8) {
          if (closing) socket.destroy();
          else {
            closing = true;
            socket.end(encodeFrame(frame.payload, { mask: true, opcode: 0x8 }));
          }
        }
        else if (frame.opcode === 0x9) socket.write(encodeFrame(frame.payload, { mask: true, opcode: 0xa }));
        else if (frame.opcode !== 0xa) throw new Error(`unsupported WebSocket opcode ${frame.opcode}`);
      }
    } catch (error) {
      connection.emit("error", error);
      socket.destroy();
    }
  };
  socket.on("data", processChunk);
  socket.on("error", (error) => connection.emit("error", error));
  socket.on("close", () => {
    closed = true;
    connection.emit("close");
  });
  connection.sendJson = (value) => {
    if (closed) throw new Error("WebSocket connection closed");
    socket.write(encodeFrame(JSON.stringify(value), { mask: true }));
  };
  connection.close = () => {
    if (!closed && !closing) {
      closing = true;
      socket.write(encodeFrame(Buffer.alloc(0), { mask: true, opcode: 0x8 }));
    }
  };
  if (remainder.length > 0) queueMicrotask(() => processChunk(remainder));
  return connection;
}
