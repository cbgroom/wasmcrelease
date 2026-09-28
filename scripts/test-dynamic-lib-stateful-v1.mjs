import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";
import { DynamicLibGraph, inspectDynamicLibPackage } from "../runtime/client-foundation-v1/dynamic-lib-graph.mjs";
import { canonicalJsonSha256, describeSerialLibGraph, describeStateMigrations } from "../runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-dynamic-lib-stateful-"));
const wit = `package wasmc:dynamic-stateful-block@0.0.1;
interface block { invoke: func(payload: list<u8>) -> result<list<u8>, string>; }
world graph-block { export block; }
`;
const schemaV1 = sha256(Buffer.from("wasmc:test-counter-state/v1"));
const schemaV2 = sha256(Buffer.from("wasmc:test-counter-state/v2"));

async function makeProvider(directory, marker, statePolicy, stateSchemaIdentity, {
  name = "counter",
  stateField = "count",
  brokenRestore = false,
  restoreDelayMs = 0,
  snapshotFault = null,
  maxOutputBytes = 65536,
} = {}) {
  const root = path.join(temporaryRoot, directory);
  await mkdir(root, { recursive: true });
  const identity = `wasmc:dynamic-stateful-${directory}@0.0.1-dev.1`;
  const adapter = Buffer.from(`
import { createHash } from "node:crypto";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
let count = 0;
const brokenRestore = ${brokenRestore};
const restoreDelayMs = ${restoreDelayMs};
const snapshotFault = ${JSON.stringify(snapshotFault)};
const stateField = ${JSON.stringify(stateField)};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation === "invoke") {
    if (request.value === "slow-inc") await new Promise((resolve) => setTimeout(resolve, 60));
    if (request.value === "inc" || request.value === "slow-inc") count += 1;
    return encoder.encode(JSON.stringify({ accepted: true, value: ${JSON.stringify(marker)} + ":" + count }));
  }
  if (request.operation === "snapshot-v1") {
    const bytes = snapshotFault === "oversize" ? Buffer.alloc(1024 * 1024 + 1) : Buffer.from(JSON.stringify({ [stateField]: count }));
    const stateBase64 = snapshotFault === "noncanonical-base64" ? bytes.toString("base64") + "=" : bytes.toString("base64");
    const stateSha256 = snapshotFault === "digest-mismatch" ? "0".repeat(64) : sha256(bytes);
    return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: ${JSON.stringify(stateSchemaIdentity)}, state_base64: stateBase64, state_sha256: stateSha256 }));
  }
  if (request.operation === "restore-v1") {
    if (restoreDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, restoreDelayMs));
    if (brokenRestore) return encoder.encode(JSON.stringify({ accepted: false, state_schema_identity: request.state_schema_identity, state_sha256: request.state_sha256 }));
    const bytes = Buffer.from(request.state_base64, "base64");
    if (sha256(bytes) !== request.state_sha256) throw new Error("restore identity mismatch");
    count = JSON.parse(bytes.toString("utf8"))[stateField];
    return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: request.state_schema_identity, state_sha256: request.state_sha256 }));
  }
  throw new Error("unsupported stateful operation");
}`);
  const descriptor = {
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit",
    state: { policy: statePolicy, schema_identity: stateSchemaIdentity },
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: maxOutputBytes }, lifecycle: "prototype-not-admitted-not-released",
  };
  await writeFile(path.join(root, "lib.wit"), wit);
  await writeFile(path.join(root, "native-adapter.mjs"), adapter);
  await writeFile(path.join(root, "native-boundary.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  const exact = await inspectDynamicLibPackage(root);
  return {
    name, root, identity, artifact_sha256: exact.artifact_sha256, wit_contract_sha256: exact.wit_contract_sha256,
    configuration: {}, configuration_sha256: canonicalJsonSha256({}), state_policy: statePolicy, state_schema_identity: stateSchemaIdentity,
  };
}

async function makeMigrationProvider(directory, fromSchemaIdentity, toSchemaIdentity, { outputFault = null } = {}) {
  const root = path.join(temporaryRoot, directory);
  await mkdir(root, { recursive: true });
  const identity = `wasmc:dynamic-state-migration-${directory}@0.0.1-dev.1`;
  const adapter = Buffer.from(`
import { createHash } from "node:crypto";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const outputFault = ${JSON.stringify(outputFault)};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation !== "migrate-state-v1") throw new Error("unsupported migration operation");
  if (request.from_schema_identity !== ${JSON.stringify(fromSchemaIdentity)} || request.to_schema_identity !== ${JSON.stringify(toSchemaIdentity)}) throw new Error("migration schema mismatch");
  const source = JSON.parse(Buffer.from(request.state_base64, "base64").toString("utf8"));
  const bytes = Buffer.from(JSON.stringify({ value: source.count }));
  return encoder.encode(JSON.stringify({
    accepted: true,
    state_schema_identity: outputFault === "schema" ? ${JSON.stringify(fromSchemaIdentity)} : ${JSON.stringify(toSchemaIdentity)},
    state_base64: bytes.toString("base64"),
    state_sha256: outputFault === "digest" ? "0".repeat(64) : sha256(bytes),
  }));
}`);
  const descriptor = {
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit",
    state_migration: { protocol: "snapshot-v1", from_schema_identity: fromSchemaIdentity, to_schema_identity: toSchemaIdentity },
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 }, lifecycle: "prototype-not-admitted-not-released",
  };
  await writeFile(path.join(root, "lib.wit"), wit);
  await writeFile(path.join(root, "native-adapter.mjs"), adapter);
  await writeFile(path.join(root, "native-boundary.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  const exact = await inspectDynamicLibPackage(root);
  return {
    node: "counter", root, identity, artifact_sha256: exact.artifact_sha256, wit_contract_sha256: exact.wit_contract_sha256,
    configuration: {}, configuration_sha256: canonicalJsonSha256({}), from_schema_identity: fromSchemaIdentity, to_schema_identity: toSchemaIdentity,
  };
}

const request = (expectedRevision, blocks, migrations = []) => ({
  expected_revision: expectedRevision, blocks, pipeline: blocks.map((block) => block.name),
  graph_digest: describeSerialLibGraph({ blocks, pipeline: blocks.map((block) => block.name) }).graph_digest,
  migrations,
  migration_plan_sha256: migrations.length > 0 ? describeStateMigrations({ migrations }).migration_plan_sha256 : null,
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
const stickyBoundary = new LibDefinedBoundary();
const stickyGraph = new DynamicLibGraph({ boundary: stickyBoundary });
const negativeGraphs = [];
try {
  const v1 = await makeProvider("snapshot-v1", "V1", "snapshot-v1", schemaV1);
  const v2 = await makeProvider("snapshot-v2", "V2", "snapshot-v1", schemaV1);
  const broken = await makeProvider("snapshot-broken", "BROKEN", "snapshot-v1", schemaV1, { brokenRestore: true, restoreDelayMs: 60 });
  const schemaMismatch = await makeProvider("snapshot-schema-v2", "SCHEMA2", "snapshot-v1", schemaV2);
  assert.equal((await graph.apply(request(0, [v1]))).outcome, "committed");
  assert.deepEqual(await graph.invoke("inc"), { revision: 1, value: "V1:1" });
  assert.deepEqual(await graph.invoke("inc"), { revision: 1, value: "V1:2" });

  const oldSlow = graph.invoke("slow-inc");
  const replacement = graph.apply(request(1, [v2]));
  await waitFor(() => graph.snapshot().invocation_barrier_active, "snapshot replacement barrier");
  const queuedNew = graph.invoke("inc");
  assert.deepEqual(await oldSlow, { revision: 1, value: "V1:3" });
  const replaced = await replacement;
  assert.deepEqual({ outcome: replaced.outcome, migrated: replaced.migrated, installed: replaced.installed, released: replaced.released }, { outcome: "committed", migrated: 1, installed: 1, released: 1 });
  assert.deepEqual(await queuedNew, { revision: 2, value: "V2:4" });

  const failedReplacement = graph.apply(request(2, [broken]));
  await waitFor(() => graph.snapshot().invocation_barrier_active, "failed restore barrier");
  const queuedAfterFailure = graph.invoke("inc");
  const failed = await failedReplacement;
  assert.equal(failed.outcome, "rolled-back");
  assert.match(failed.error, /snapshot restore rejected/);
  assert.deepEqual(await queuedAfterFailure, { revision: 2, value: "V2:5" });
  assert.equal(graph.snapshot().invocation_barrier_active, false);

  const mismatched = await graph.apply(request(2, [schemaMismatch]));
  assert.equal(mismatched.outcome, "rolled-back");
  assert.match(mismatched.error, /exact migration Lib/);
  assert.deepEqual(await graph.invoke("get"), { revision: 2, value: "V2:5" });

  const crossBoundary = new LibDefinedBoundary();
  const crossGraph = new DynamicLibGraph({ boundary: crossBoundary });
  negativeGraphs.push(crossGraph);
  const crossSource = await makeProvider("cross-source-v1", "CROSS1", "snapshot-v1", schemaV1);
  const crossTarget = await makeProvider("cross-target-v2", "CROSS2", "snapshot-v1", schemaV2, { stateField: "value" });
  const crossMigration = await makeMigrationProvider("v1-to-v2", schemaV1, schemaV2);
  const brokenCrossMigration = await makeMigrationProvider("v1-to-v2-broken", schemaV1, schemaV2, { outputFault: "digest" });
  assert.equal((await crossGraph.apply(request(0, [crossSource]))).outcome, "committed");
  assert.deepEqual(await crossGraph.invoke("inc"), { revision: 1, value: "CROSS1:1" });
  assert.deepEqual(await crossGraph.invoke("inc"), { revision: 1, value: "CROSS1:2" });
  const absentCrossMigration = await crossGraph.apply(request(1, [crossTarget]));
  assert.equal(absentCrossMigration.outcome, "rolled-back");
  assert.match(absentCrossMigration.error, /requires an exact migration Lib/);
  const brokenCrossResult = await crossGraph.apply(request(1, [crossTarget], [brokenCrossMigration]));
  assert.equal(brokenCrossResult.outcome, "rolled-back");
  assert.match(brokenCrossResult.error, /snapshot identity mismatch/);
  assert.deepEqual(await crossGraph.invoke("get"), { revision: 1, value: "CROSS1:2" });
  const crossResult = await crossGraph.apply(request(1, [crossTarget], [crossMigration]));
  assert.deepEqual({ outcome: crossResult.outcome, migrated: crossResult.migrated, migration_libs: crossResult.migration_libs }, { outcome: "committed", migrated: 1, migration_libs: 1 });
  assert.deepEqual(await crossGraph.invoke("get"), { revision: 2, value: "CROSS2:2" });
  await crossGraph.close();
  assert.deepEqual(crossBoundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const checkpointOldInvocation = graph.invoke("slow-inc");
  const checkpointCapture = graph.captureStateCheckpoint();
  await waitFor(() => graph.snapshot().invocation_barrier_active, "active checkpoint barrier");
  const checkpointQueuedInvocation = graph.invoke("inc");
  assert.deepEqual(await checkpointOldInvocation, { revision: 2, value: "V2:6" });
  const activeCheckpoint = await checkpointCapture;
  assert.deepEqual(await checkpointQueuedInvocation, { revision: 2, value: "V2:7" });
  assert.equal(activeCheckpoint.graph_revision, 2);
  assert.equal(activeCheckpoint.graph_digest, request(2, [v2]).graph_digest);
  assert.equal(activeCheckpoint.blocks.length, 1);
  assert.match(activeCheckpoint.checkpoint_sha256, /^[a-f0-9]{64}$/);
  const restartBoundary = new LibDefinedBoundary();
  const restartGraph = new DynamicLibGraph({ boundary: restartBoundary, initialRevision: 1 });
  negativeGraphs.push(restartGraph);
  assert.equal((await restartGraph.apply(request(1, [v2]))).outcome, "committed");
  assert.deepEqual(await restartGraph.restoreStateCheckpoint(activeCheckpoint), { restored: 1, checkpoint_sha256: activeCheckpoint.checkpoint_sha256 });
  assert.deepEqual(await restartGraph.invoke("get"), { revision: 2, value: "V2:6" });
  await assert.rejects(restartGraph.restoreStateCheckpoint({ ...activeCheckpoint, checkpoint_sha256: "0".repeat(64) }), /checkpoint digest mismatch/);
  await restartGraph.close();
  assert.deepEqual(restartBoundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const partialRestoreBoundary = new LibDefinedBoundary();
  const partialRestoreGraph = new DynamicLibGraph({ boundary: partialRestoreBoundary });
  negativeGraphs.push(partialRestoreGraph);
  const restoreFirst = await makeProvider("restore-first", "RESTORE-FIRST", "snapshot-v1", schemaV1, { name: "a-first" });
  const restoreBroken = await makeProvider("restore-broken", "RESTORE-BROKEN", "snapshot-v1", schemaV1, { name: "b-broken", brokenRestore: true });
  const partialRequest = request(0, [restoreFirst, restoreBroken]);
  assert.equal((await partialRestoreGraph.apply(partialRequest)).outcome, "committed");
  const partialCheckpoint = await partialRestoreGraph.captureStateCheckpoint();
  await assert.rejects(partialRestoreGraph.restoreStateCheckpoint(partialCheckpoint), /snapshot restore rejected/);
  assert.equal(partialRestoreGraph.snapshot().restore_failed, true);
  await assert.rejects(partialRestoreGraph.invoke("get"), /restore failed; close and reconstruct/);
  await assert.rejects(partialRestoreGraph.captureStateCheckpoint(), /restore failed; close and reconstruct/);
  await assert.rejects(partialRestoreGraph.apply({ ...partialRequest, expected_revision: 1 }), /restore failed; close and reconstruct/);
  await partialRestoreGraph.close();
  assert.deepEqual(partialRestoreBoundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const sticky1 = await makeProvider("sticky-v1", "STICKY1", "sticky", schemaV1);
  const sticky2 = await makeProvider("sticky-v2", "STICKY2", "sticky", schemaV1);
  assert.equal((await stickyGraph.apply(request(0, [sticky1]))).outcome, "committed");
  assert.equal((await stickyGraph.apply(request(1, [sticky1]))).outcome, "unchanged");
  const stickyReplacement = await stickyGraph.apply(request(1, [sticky2]));
  assert.equal(stickyReplacement.outcome, "rolled-back");
  assert.match(stickyReplacement.error, /cannot be replaced automatically/);
  assert.deepEqual(await stickyGraph.invoke("inc"), { revision: 1, value: "STICKY1:1" });

  const stateless = await makeProvider("stateless", "STATELESS", "stateless", null);
  const policyTransition = await graph.apply(request(2, [stateless]));
  assert.equal(policyTransition.outcome, "rolled-back");
  assert.match(policyTransition.error, /state policy transition is unsupported/);
  const stickyRemoval = await stickyGraph.apply(request(1, [{ ...stateless, name: "replacement" }]));
  assert.equal(stickyRemoval.outcome, "rolled-back");
  assert.match(stickyRemoval.error, /stateful node removal requires an explicit state disposition/);

  const mismatchedBoundary = new LibDefinedBoundary();
  const mismatchedGraph = new DynamicLibGraph({ boundary: mismatchedBoundary });
  negativeGraphs.push(mismatchedGraph);
  const mismatchedDeclaration = { ...v1, state_policy: "sticky" };
  const packageMismatch = await mismatchedGraph.apply(request(0, [mismatchedDeclaration]));
  assert.equal(packageMismatch.outcome, "rolled-back");
  assert.match(packageMismatch.error, /package state contract mismatch/);
  await mismatchedGraph.close();
  assert.deepEqual(mismatchedBoundary.counts(), { resources: 0, windows: 0, operations: 0 });

  for (const [fault, maxOutputBytes] of [["noncanonical-base64", 65536], ["digest-mismatch", 65536], ["oversize", 2 * 1024 * 1024]]) {
    const faultBoundary = new LibDefinedBoundary();
    const faultGraph = new DynamicLibGraph({ boundary: faultBoundary });
    negativeGraphs.push(faultGraph);
    const source = await makeProvider(`snapshot-${fault}`, `FAULT-${fault}`, "snapshot-v1", schemaV1, { snapshotFault: fault, maxOutputBytes });
    const rejected = await faultGraph.apply(request(0, [source]));
    assert.equal(rejected.outcome, "rolled-back");
    assert.match(rejected.error, /snapshot identity mismatch/);
    await faultGraph.close();
    assert.deepEqual(faultBoundary.counts(), { resources: 0, windows: 0, operations: 0 });
  }

  await graph.close();
  await stickyGraph.close();
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  assert.deepEqual(stickyBoundary.counts(), { resources: 0, windows: 0, operations: 0 });
  console.log(JSON.stringify({
    accepted: true, schema: "wasmc.dynamic-lib-stateful-local-qualification/v1", lifecycle: "prototype-local-qualified-not-admitted-not-released",
    snapshot_same_schema_replacement: "V1:3->V2:4", old_invocation_drained_before_snapshot: true,
    new_invocation_blocked_until_publish: true, failed_restore_rolled_back: true, invocation_barrier_released_after_rollback: true,
    cross_schema_exact_migration_lib: "CROSS1:2->CROSS2:2", cross_schema_missing_migration_rejected: true, cross_schema_broken_migration_rolled_back: true,
    sticky_unchanged_reused: true, sticky_automatic_replacement_rejected: true,
    package_state_contract_mismatch_rejected: true, state_policy_transition_rejected: true, stateful_removal_without_disposition_rejected: true,
    noncanonical_snapshot_rejected: true, snapshot_digest_mismatch_rejected: true, oversized_snapshot_rejected: true,
    active_checkpoint_restored: "V2:6", checkpoint_barrier_queued_new_invocation: "V2:7", corrupt_checkpoint_rejected: true,
    partial_checkpoint_restore_poisoned_until_close: true,
    external_effect_exactly_once_claimed: false, fixed_host_api_changed: false, minimal_cli_changed: false,
    boundary_counts_after_close: boundary.counts(), sticky_boundary_counts_after_close: stickyBoundary.counts(),
  }));
} finally {
  await graph.close().catch(() => {});
  await stickyGraph.close().catch(() => {});
  for (const negativeGraph of negativeGraphs) await negativeGraph.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
