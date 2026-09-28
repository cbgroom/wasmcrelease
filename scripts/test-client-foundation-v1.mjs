import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ClientFoundation } from "../runtime/client-foundation-v1/foundation.mjs";
import { createClientFoundationGateway } from "./fixtures/client-foundation-gateway.mjs";

const root = process.cwd();
const protectedPaths = [
  "current/cli.mjs",
  "current/wasmc.mjs",
  "host/runtime/lib-boundary/reference.mjs",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestProtected = async () => Object.fromEntries(await Promise.all(protectedPaths.map(async (relative) => [
  relative,
  sha256(await readFile(path.join(root, relative))),
])));
const before = await digestProtected();
const stateRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-client-foundation-"));
const gateway = await createClientFoundationGateway();
const factoryRoot = path.join(root, "runtime/client-foundation-v1/factory-provider");
const controller = new AbortController();
const foundation = new ClientFoundation({
  stateRoot,
  factoryRoot,
  gatewayUrl: gateway.url,
  ca: gateway.ca,
  reconnectDelayMs: 25,
});

try {
  const running = foundation.run(controller.signal);
  let timeoutId;
  const evidence = await Promise.race([
    gateway.done,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Client Foundation test timeout")), 10000);
    }),
  ]).finally(() => clearTimeout(timeoutId));
  controller.abort();
  await running;
  const state = foundation.snapshot();
  assert.equal(state.phase, "committed");
  assert.equal(state.graph_revision, 2);
  assert.equal(state.active.kind, "slot");
  assert.equal(state.active.slot, "A");
  assert.equal(state.active.identity, "wasmc:client-foundation-dynamic@0.0.1-dev.1");
  assert.equal(state.last_known_good.identity, state.active.identity);
  assert.equal(state.slots.A.identity, state.active.identity);
  assert.equal(state.slots.B.identity, "wasmc:client-foundation-broken@0.0.1-dev.1");
  assert.equal(state.rollback_count, 1);
  assert.equal(state.last_server_sequence, 4);
  assert.deepEqual(Object.keys(state.receipts), ["m1", "m2", "m3", "m4"]);
  assert.equal(evidence.connections, 2);
  assert.equal(evidence.replayed_receipts, 1);
  assert.equal(evidence.committed_receipts, 1);
  assert.equal(evidence.rolled_back_receipts, 1);
  assert.equal(evidence.invoke_receipts, 1);
  await foundation.close();
  assert.deepEqual(foundation.boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const recovered = new ClientFoundation({
    stateRoot,
    factoryRoot,
    gatewayUrl: gateway.url,
    ca: gateway.ca,
  });
  await recovered.initialize();
  const coldResponse = await recovered.invoke("cold-recovery");
  assert.equal(coldResponse.value, "dynamic:cold-recovery");
  assert.equal(recovered.snapshot().graph_revision, 2);
  await recovered.close();
  assert.deepEqual(recovered.boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const statePath = path.join(stateRoot, "state.json");
  const interrupted = JSON.parse(await readFile(statePath, "utf8"));
  interrupted.phase = "active-probation";
  interrupted.last_known_good = interrupted.active;
  interrupted.active = interrupted.slots.B;
  interrupted.graph_revision = 3;
  interrupted.probation_previous_revision = 2;
  await writeFile(statePath, `${JSON.stringify(interrupted, null, 2)}\n`);
  const crashRecovered = new ClientFoundation({
    stateRoot,
    factoryRoot,
    gatewayUrl: gateway.url,
    ca: gateway.ca,
  });
  await crashRecovered.initialize();
  const rollbackResponse = await crashRecovered.invoke("probation-recovery");
  assert.equal(rollbackResponse.value, "dynamic:probation-recovery");
  assert.equal(crashRecovered.snapshot().graph_revision, 2);
  assert.equal(crashRecovered.snapshot().phase, "committed");
  assert.equal(crashRecovered.snapshot().rollback_count, 2);
  await crashRecovered.close();
  assert.deepEqual(crashRecovered.boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  await rm(path.join(stateRoot, "slots", "A"), { recursive: true, force: true });
  const factoryRescued = new ClientFoundation({
    stateRoot,
    factoryRoot,
    gatewayUrl: gateway.url,
    ca: gateway.ca,
  });
  await factoryRescued.initialize();
  const factoryResponse = await factoryRescued.invoke("missing-slot-recovery");
  assert.equal(factoryResponse.value, "factory:missing-slot-recovery");
  assert.equal(factoryRescued.snapshot().active.kind, "factory");
  assert.equal(factoryRescued.snapshot().graph_revision, 2);
  assert.equal(factoryRescued.snapshot().rollback_count, 3);
  await factoryRescued.close();
  assert.deepEqual(factoryRescued.boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const after = await digestProtected();
  assert.deepEqual(after, before, "fixed Host or minimal CLI changed during higher-layer test");
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.client-foundation-local-qualification/v1",
    lifecycle: "prototype-local-qualified-not-admitted-not-released",
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
    wss_control: true,
    https_artifact: true,
    slots: ["A", "B"],
    immutable_factory_rescue: true,
    committed_graph_revision: 2,
    active_provider: state.active.identity,
    reconnects: evidence.connections - 1,
    duplicate_command_replayed: evidence.replayed_receipts,
    broken_candidate_rollbacks: state.rollback_count,
    cold_recovery: coldResponse.value,
    probation_crash_recovery: rollbackResponse.value,
    missing_slot_factory_rescue: factoryResponse.value,
    boundary_counts_after_close: factoryRescued.boundary.counts(),
    protected_sha256: after,
  }));
} finally {
  controller.abort();
  await foundation.close().catch(() => {});
  await gateway.close().catch(() => {});
  await rm(stateRoot, { recursive: true, force: true });
}
