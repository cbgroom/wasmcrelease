import { createConnection } from "node:net";

const utf8 = new TextDecoder("utf-8", { fatal: true });

const decode = (input) => {
  if (input.length < 6) throw new Error("truncated exchange request");
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const hostLength = view.getUint32(0, true);
  const portOffset = 4 + hostLength;
  if (portOffset + 2 > input.length) throw new Error("truncated host");
  return {
    host: utf8.decode(input.subarray(4, portOffset)),
    port: view.getUint16(portOffset, true),
    payload: input.subarray(portOffset + 2),
  };
};

export function invoke(input, { signal }) {
  if (signal.aborted) return Promise.reject(new Error("cancelled"));
  const request = decode(input);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = createConnection({ host: request.host, port: request.port });
    const abort = () => socket.destroy(new Error("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    socket.on("connect", () => socket.end(request.payload));
    socket.on("data", (chunk) => chunks.push(Uint8Array.from(chunk)));
    socket.on("error", reject);
    socket.on("close", () => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) return;
      const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const output = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
      resolve(output);
    });
  });
}
