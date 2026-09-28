import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";
import { DynamicLibGraph, inspectDynamicLibPackage } from "../runtime/client-foundation-v1/dynamic-lib-graph.mjs";
import { canonicalJson, canonicalJsonSha256, describeSerialLibGraph } from "../runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs";

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
    return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)}, value: ${JSON.stringify(marker)} + (request.configuration?.suffix ?? "") + "(" + request.value + ")" }));
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
  const exact = await inspectDynamicLibPackage(root);
  const configuration = {};
  return {
    name: name.split("-")[0],
    root,
    identity,
    artifact_sha256: exact.artifact_sha256,
    wit_contract_sha256: exact.wit_contract_sha256,
    configuration,
    configuration_sha256: canonicalJsonSha256(configuration),
    state_policy: "stateless",
    state_schema_identity: null,
  };
}

const withConfiguration = (block, configuration) => ({ ...block, configuration, configuration_sha256: canonicalJsonSha256(configuration) });
const request = (expected_revision, blocks, pipeline) => ({
  expected_revision,
  blocks,
  pipeline,
  graph_digest: describeSerialLibGraph({ blocks, pipeline }).graph_digest,
});
const waitFor = async (predicate, label) => {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

const boundary = new LibDefinedBoundary();
const graph = new DynamicLibGraph({ boundary });
try {
  const a1 = await makeProvider("a-v1", "A1", { slow: true });
  const a2 = await makeProvider("a-v2", "A2");
  const b1 = await makeProvider("b-v1", "B1");
  const b2Broken = await makeProvider("b-v2-broken", "B2", { broken: true });

  assert.equal(canonicalJson({ beta: [2, 3], alpha: 1 }), '{"alpha":1,"beta":[2,3]}');
  assert.equal(canonicalJsonSha256({ beta: 2, alpha: 1 }), canonicalJsonSha256({ alpha: 1, beta: 2 }));
  assert.notEqual(canonicalJsonSha256([1, 2]), canonicalJsonSha256([2, 1]));
  assert.throws(() => canonicalJson([, 1]), /sparse array/);
  assert.throws(() => canonicalJson({ invalid: undefined }), /non-JSON value/);
  assert.throws(() => canonicalJson({ invalid: Number.NaN }), /non-finite number/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycle/);

  const firstRequest = request(0, [a1, b1], ["a", "b"]);
  assert.equal(firstRequest.graph_digest, request(0, [b1, a1], ["a", "b"]).graph_digest);
  assert.equal(firstRequest.graph_digest, request(0, [{ ...a1, root: "/ignored/local/locator" }, b1], ["a", "b"]).graph_digest);
  assert.notEqual(firstRequest.graph_digest, request(0, [a1, b1], ["b", "a"]).graph_digest);
  assert.throws(() => request(0, [a1, b1], ["a"]), /every block exactly once/);
  assert.throws(() => request(0, [a1, b1], ["a", "a"]), /every block exactly once/);
  const first = await graph.apply(firstRequest);
  assert.deepEqual({ outcome: first.outcome, installed: first.installed, reused: first.reused, released: first.released }, { outcome: "committed", installed: 2, reused: 0, released: 0 });
  assert.equal(graph.snapshot().graph_digest, firstRequest.graph_digest);
  assert.deepEqual(await graph.invoke("x"), { revision: 1, value: "B1(A1(x))" });

  const slowOld = graph.invoke("slow");
  const replacing = graph.apply(request(1, [a2, b1], ["a", "b"]));
  await waitFor(() => graph.snapshot().revision === 2, "replacement publication");
  const fastNew = graph.invoke("fast");
  assert.deepEqual(await fastNew, { revision: 2, value: "B1(A2(fast))" });
  await assert.rejects(
    graph.apply(request(2, [a2, b1], ["b", "a"])),
    /update already in progress/,
  );
  assert.deepEqual(await slowOld, { revision: 1, value: "B1(A1(slow))" });
  const replaced = await replacing;
  assert.deepEqual({ outcome: replaced.outcome, installed: replaced.installed, reused: replaced.reused, released: replaced.released }, { outcome: "committed", installed: 1, reused: 1, released: 1 });
  assert.deepEqual(await graph.invoke("x"), { revision: 2, value: "B1(A2(x))" });

  const reordered = await graph.apply(request(2, [a2, b1], ["b", "a"]));
  assert.deepEqual({ outcome: reordered.outcome, installed: reordered.installed, reused: reordered.reused, released: reordered.released }, { outcome: "committed", installed: 0, reused: 2, released: 0 });
  assert.deepEqual(await graph.invoke("x"), { revision: 3, value: "A2(B1(x))" });

  const a2Configured = withConfiguration(a2, { suffix: "C", nested: { beta: 2, alpha: 1 } });
  const configured = await graph.apply(request(3, [a2Configured, b1], ["b", "a"]));
  assert.deepEqual({ outcome: configured.outcome, installed: configured.installed, reused: configured.reused, released: configured.released }, { outcome: "committed", installed: 1, reused: 1, released: 1 });
  assert.deepEqual(await graph.invoke("x"), { revision: 4, value: "A2C(B1(x))" });
  a2Configured.configuration.suffix = "MUTATED-AFTER-PUBLISH";
  assert.deepEqual(await graph.invoke("x"), { revision: 4, value: "A2C(B1(x))" });
  a2Configured.configuration.suffix = "C";
  const unchanged = await graph.apply(request(4, [b1, { ...a2Configured, configuration: { nested: { alpha: 1, beta: 2 }, suffix: "C" } }], ["b", "a"]));
  assert.deepEqual({ outcome: unchanged.outcome, revision: unchanged.revision, installed: unchanged.installed, released: unchanged.released }, { outcome: "unchanged", revision: 4, installed: 0, released: 0 });

  await assert.rejects(graph.apply({ ...request(4, [a2Configured, b1], ["b", "a"]), graph_digest: "0".repeat(64) }), /graph digest mismatch/);
  await assert.rejects(async () => graph.apply(request(4, [{ ...a2Configured, configuration_sha256: "0".repeat(64) }, b1], ["b", "a"])), /configuration identity mismatch/);
  await assert.rejects(async () => graph.apply(request(4, [{ ...a2Configured, wit_contract_sha256: "0".repeat(64) }, b1], ["a", "b"])), /WIT port contract mismatch/);
  await assert.rejects(async () => graph.apply(request(4, [{ ...a2Configured, state_policy: "unknown-state-policy" }, b1], ["b", "a"])), /unsupported dynamic Lib state policy/);

  const falseIdentity = await graph.apply(request(4, [{ ...a2Configured, identity: "wasmc:false-identity@0.0.1" }, b1], ["a", "b"]));
  assert.equal(falseIdentity.outcome, "rolled-back");
  assert.match(falseIdentity.error, /identity conflicts with retained instance/);
  const falseArtifact = await graph.apply(request(4, [{ ...a2Configured, artifact_sha256: "0".repeat(64) }, b1], ["a", "b"]));
  assert.equal(falseArtifact.outcome, "rolled-back");
  assert.match(falseArtifact.error, /package identity mismatch/);
  assert.deepEqual(graph.snapshot().pipeline, ["b", "a"]);

  const rejecting = graph.apply(request(4, [a2Configured, b2Broken], ["a", "b"]));
  await waitFor(() => boundary.counts().resources === 3 && graph.snapshot().revision === 4, "unpublished broken candidate");
  assert.deepEqual(await graph.invoke("during-broken-candidate"), { revision: 4, value: "A2C(B1(during-broken-candidate))" });
  const rejected = await rejecting;
  assert.equal(rejected.outcome, "rolled-back");
  assert.equal(rejected.revision, 4);
  assert.deepEqual(await graph.invoke("x"), { revision: 4, value: "A2C(B1(x))" });
  assert.deepEqual(graph.snapshot().pipeline, ["b", "a"]);

  await graph.close();
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const cleanupBoundary = new LibDefinedBoundary();
  const cleanupGraph = new DynamicLibGraph({ boundary: cleanupBoundary });
  const cleanupFirst = request(0, [a1, b1], ["a", "b"]);
  assert.equal((await cleanupGraph.apply(cleanupFirst)).outcome, "committed");
  const cleanupFailure = await cleanupGraph.apply({
    ...request(1, [a2, b1], ["a", "b"]),
    onPublished: async () => { throw new Error("intentional durable publication barrier failure"); },
  });
  assert.equal(cleanupFailure.outcome, "committed");
  assert.match(cleanupFailure.cleanup_error, /publication barrier failure/);
  assert.equal(cleanupGraph.snapshot().retired.length, 1);
  await assert.rejects(cleanupGraph.apply(request(2, [a2, b1], ["a", "b"])), /retired cleanup pending/);
  await cleanupGraph.close();
  assert.deepEqual(cleanupBoundary.counts(), { resources: 0, windows: 0, operations: 0 });
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
    canonical_graph_digest: graph.snapshot().graph_digest,
    canonical_declaration_order: true,
    canonical_json_negative_controls: 4,
    local_root_excluded_from_digest: true,
    pipeline_order_bound_to_digest: true,
    serial_graph_closure_rejected: true,
    configuration_replacement: "A2C(B1(x))",
    configuration_reinstalled: 1,
    configuration_snapshot_immutable: true,
    unchanged_graph_noop: true,
    false_graph_digest_rejected: true,
    false_configuration_digest_rejected: true,
    incompatible_wit_contract_rejected: true,
    unsupported_state_policy_rejected: true,
    broken_replacement_rolled_back: true,
    broken_candidate_never_visible: true,
    postpublication_cleanup_failure_retained: true,
    later_update_blocked_until_cleanup: true,
    false_identity_rejected: true,
    false_artifact_rejected: true,
    final_revision: 4,
    boundary_counts_after_close: boundary.counts(),
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
  }));
} finally {
  await graph.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
