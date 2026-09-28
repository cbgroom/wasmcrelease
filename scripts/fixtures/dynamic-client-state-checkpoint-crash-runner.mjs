import { readFile } from "node:fs/promises";
import { DynamicGraphClientFoundation } from "../../runtime/client-foundation-v1/dynamic-foundation.mjs";

const [stateRoot, gatewayUrl, caPath] = process.argv.slice(2);
if (!stateRoot || !gatewayUrl || !caPath) throw new Error("invalid state checkpoint crash runner arguments");

const client = new DynamicGraphClientFoundation({
  stateRoot,
  gatewayUrl,
  ca: await readFile(caPath),
  reconnectDelayMs: 10,
  afterStateCheckpointPersist: async ({ inflight_result: inflightResult }) => {
    if (inflightResult?.outcome === "completed") process.exit(87);
  },
});

await client.run();
