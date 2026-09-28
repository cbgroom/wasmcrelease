#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { deriveWitPortContracts } from "../runtime/client-foundation-v1/wit-port-contracts.mjs";

const run = promisify(execFile);
const [witPath, outputPath, world, interfaceName, functionName = "invoke"] = process.argv.slice(2);
if (!witPath || !outputPath || !world || !interfaceName) {
  throw new Error("usage: generate-wit-port-contracts-v1.mjs <wit> <output> <world> <interface> [function]");
}
const [{ stdout }, witBytes] = await Promise.all([
  run("wasm-tools", ["component", "wit", witPath, "--json"], { maxBuffer: 16 * 1024 * 1024 }),
  readFile(witPath),
]);
const manifest = deriveWitPortContracts(JSON.parse(stdout), {
  world,
  interface: interfaceName,
  function: functionName,
  wit_sha256: createHash("sha256").update(witBytes).digest("hex"),
});
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ accepted: true, output: outputPath, contract_set_sha256: manifest.contract_set_sha256 }));
