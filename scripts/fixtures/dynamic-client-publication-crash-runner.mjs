import { readFile } from "node:fs/promises";
import { DynamicGraphClientFoundation } from "../../runtime/client-foundation-v1/dynamic-foundation.mjs";

const [stateRoot, gatewayUrl, caPath, revisionText] = process.argv.slice(2);
const crashRevision = Number(revisionText);
if (!stateRoot || !gatewayUrl || !caPath || !Number.isSafeInteger(crashRevision)) throw new Error("invalid publication crash runner arguments");

const client = new DynamicGraphClientFoundation({
  stateRoot,
  gatewayUrl,
  ca: await readFile(caPath),
  reconnectDelayMs: 10,
  afterPublicationPersist: async ({ revision }) => {
    if (revision === crashRevision) process.exit(86);
  },
});

await client.run();
