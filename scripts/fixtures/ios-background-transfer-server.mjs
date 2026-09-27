import http from "node:http";

const port = Number(process.argv[2] ?? 18765);
const payload = Buffer.allocUnsafe(8 * 1024 * 1024);
for (let index = 0; index < payload.length; index += 1) payload[index] = index % 251;

const server = http.createServer((request, response) => {
  if (request.url === "/ready") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ready\n");
    return;
  }
  if (request.url !== "/payload.bin") {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": payload.length,
    "cache-control": "no-store",
  });
  let offset = 0;
  const timer = setInterval(() => {
    if (offset >= payload.length) {
      clearInterval(timer);
      response.end();
      return;
    }
    const next = Math.min(offset + 64 * 1024, payload.length);
    response.write(payload.subarray(offset, next));
    offset = next;
  }, 50);
  response.on("close", () => clearInterval(timer));
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
