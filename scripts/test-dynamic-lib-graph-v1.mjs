import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";
import { DynamicLibGraph, inspectDynamicLibPackage } from "../runtime/client-foundation-v1/dynamic-lib-graph.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-dynamic-lib-graph-"));
const wit = `package wasmc:dynamic-graph-block@0.0.1;\ninterface block { invoke: func(payload: list<u8>) -> result<list<u8>, string>; }\nworld graph-block { export block; }\n`;

async function makeProvider(name, marker, { broken = false, slow = false } = {}) {
  const root = path.join(temporaryRoot, name);
  await mkdir(root, { recursive: true });
  const identity = `wasmc:dynamic-graph-${name}@0.0.1-dev.1`;
  const source = `
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
let health = 0;
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe") return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)} }));
  if (request.operation === "health") {
    health += 1;
    ${broken ? "if (health > 1) { await new Promise((resolve) => setTimeout(resolve, 30)); throw new Error(\"intentional replacement health failure\"); }" : ""}
    return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)} }));
  }
  if (request.operation === "invoke") {
    ${slow ? "if (request.value === \"slow\") await new Promise((resolve) => setTimeout(resolve, 50));" : ""}
    return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)}, value: ${JSON.stringify(marker)} + "(" + request.value + ")" }));
  }
  throw new Error("unsupported graph block operation");
}
`;
  const adapter = Buffer.from(source);
  const descriptor = {
    schema: "wasmc.native-boundary-descriptor/v1",
    identity,
    wit: "lib.wit",
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 },
    lifecycle: "prototype-not-admitted-not-released",
  };
  await writeFile(path.join(root, "lib.wit"), wit);
  await writeFile(path.join(root, "native-adapter.mjs"), adapter);
  await writeFile(path.join(root, "native-boundary.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  return { name: name.split("-")[0], root, identity, artifact_sha256: (await inspectDynamicLibPackage(root)).artifact_sha256 };
}

const boundary = new LibDefinedBoundary();
const graph = new DynamicLibGraph({ boundary });
try {
  const a1 = await makeProvider("a-v1", "A1", { slow: true });
  const a2 = await makeProvider("a-v2", "A2");
  const b1 = await makeProvider("b-v1", "B1");
  const b2Broken = await makeProvider("b-v2-broken", "B2", { broken: true });

  const first = await graph.apply({ expected_revision: 0, blocks: [a1, b1], pipeline: ["a", "b"] });
  assert.deepEqual({ outcome: first.outcome, installed: first.installed, reused: first.reused, released: first.released }, { outcome: "committed", installed: 2, reused: 0, released: 0 });
  assert.deepEqual(await graph.invoke("x"), { revision: 1, value: "B1(A1(x))" });

  const slowOld = graph.invoke("slow");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const replacing = graph.apply({ expected_revision: 1, blocks: [a2, b1], pipeline: ["a", "b"] });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const fastNew = graph.invoke("fast");
  assert.deepEqual(await fastNew, { revision: 2, value: "B1(A2(fast))" });
  await assert.rejects(
    graph.apply({ expected_revision: 2, blocks: [a2, b1], pipeline: ["b", "a"] }),
    /update already in progress/,
  );
  assert.deepEqual(await slowOld, { revision: 1, value: "B1(A1(slow))" });
  const replaced = await replacing;
  assert.deepEqual({ outcome: replaced.outcome, installed: replaced.installed, reused: replaced.reused, released: replaced.released }, { outcome: "committed", installed: 1, reused: 1, released: 1 });
  assert.deepEqual(await graph.invoke("x"), { revision: 2, value: "B1(A2(x))" });

  const reordered = await graph.apply({ expected_revision: 2, blocks: [a2, b1], pipeline: ["b", "a"] });
  assert.deepEqual({ outcome: reordered.outcome, installed: reordered.installed, reused: reordered.reused, released: reordered.released }, { outcome: "committed", installed: 0, reused: 2, released: 0 });
  assert.deepEqual(await graph.invoke("x"), { revision: 3, value: "A2(B1(x))" });

  const falseIdentity = await graph.apply({ expected_revision: 3, blocks: [{ ...a2, identity: "wasmc:false-identity@0.0.1" }, b1], pipeline: ["a", "b"] });
  assert.equal(falseIdentity.outcome, "rolled-back");
  assert.match(falseIdentity.error, /identity conflicts/);
  const falseArtifact = await graph.apply({ expected_revision: 3, blocks: [{ ...a2, artifact_sha256: "0".repeat(64) }, b1], pipeline: ["a", "b"] });
  assert.equal(falseArtifact.outcome, "rolled-back");
  assert.match(falseArtifact.error, /package identity mismatch/);
  assert.deepEqual(graph.snapshot().pipeline, ["b", "a"]);

  const rejecting = graph.apply({ expected_revision: 3, blocks: [a2, b2Broken], pipeline: ["a", "b"] });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(await graph.invoke("during-broken-candidate"), { revision: 3, value: "A2(B1(during-broken-candidate))" });
  const rejected = await rejecting;
  assert.equal(rejected.outcome, "rolled-back");
  assert.equal(rejected.revision, 3);
  assert.deepEqual(await graph.invoke("x"), { revision: 3, value: "A2(B1(x))" });
  assert.deepEqual(graph.snapshot().pipeline, ["b", "a"]);

  await graph.close();
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.dynamic-lib-graph-local-qualification/v1",
    lifecycle: "prototype-local-qualified-not-admitted-not-released",
    initial_composition: "B1(A1(x))",
    one_block_replacement: "B1(A2(x))",
    unchanged_block_reused: true,
    atomic_generation_overlap: { old: "B1(A1(slow))", new: "B1(A2(fast))" },
    concurrent_update_rejected: true,
    route_only_reorder: "A2(B1(x))",
    route_only_installed: 0,
    broken_replacement_rolled_back: true,
    broken_candidate_never_visible: true,
    false_identity_rejected: true,
    false_artifact_rejected: true,
    final_revision: 3,
    boundary_counts_after_close: boundary.counts(),
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
  }));
} finally {
  await graph.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
