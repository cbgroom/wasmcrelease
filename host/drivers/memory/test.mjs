import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const binary = process.argv[2];
if (!binary) throw new Error("usage: node host/drivers/memory/test.mjs BINARY");

const run = spawnSync(binary, [], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const result = JSON.parse(run.stdout.trim());
assert.deepEqual(result, {
  capacity: 64,
  read: "wasmc",
  bounds: "bounds",
  retired: "retired",
});
console.log(JSON.stringify({ accepted: true, provider: "bounded-memory", result }));
