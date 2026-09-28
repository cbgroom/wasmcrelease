import { createHash } from "node:crypto";
import fs from "node:fs";
import tls from "node:tls";

const port = Number(process.argv[2] ?? 18767);
const sockets = new Set();
const options = {
  cert: fs.readFileSync("scripts/fixtures/ios-wss-cert.pem"),
  key: fs.readFileSync("scripts/fixtures/ios-wss-key.pem"),
};

function frame(text) {
  const payload = Buffer.from(text);
  if (payload.length >= 126) throw new Error("fixture payload too large");
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

function decode(buffer) {
  if (buffer.length < 2) return null;
  const masked = (buffer[1] & 0x80) !== 0;
  const length = buffer[1] & 0x7f;
  if (length === 126 || length === 127) throw new Error("extended fixture frame unsupported");
  const header = masked ? 6 : 2;
  if (buffer.length < header + length) return null;
  const payload = Buffer.from(buffer.subarray(header, header + length));
  if (masked) {
    const mask = buffer.subarray(2, 6);
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return { opcode: buffer[0] & 0x0f, text: payload.toString("utf8"), bytes: header + length };
}

const server = tls.createServer(options, (socket) => {
  sockets.add(socket);
  let upgraded = false;
  let retained = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    retained = Buffer.concat([retained, chunk]);
    if (!upgraded) {
      const end = retained.indexOf("\r\n\r\n");
      if (end < 0) return;
      const headers = retained.subarray(0, end).toString("utf8");
      const key = headers.match(/^Sec-WebSocket-Key:\s*(.+)$/mi)?.[1]?.trim();
      if (!key) return socket.destroy();
      const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      retained = retained.subarray(end + 4);
      upgraded = true;
    }
    while (upgraded) {
      const decoded = decode(retained);
      if (!decoded) break;
      retained = retained.subarray(decoded.bytes);
      if (decoded.opcode === 0x8) return socket.end();
      if (decoded.opcode !== 0x1) continue;
      if (decoded.text === "client-foreground") socket.write(frame("server-foreground"));
      if (decoded.text === "client-background") socket.write(frame("server-background"));
    }
  });
  socket.on("close", () => sockets.delete(socket));
});

server.listen(port, "127.0.0.1", () => process.stdout.write("READY\n"));
process.on("SIGTERM", () => {
  for (const socket of sockets) socket.destroy();
  server.close(() => process.exit(0));
});
