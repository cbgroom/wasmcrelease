import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";
import { DynamicLibGraph, inspectDynamicLibPackage } from "../runtime/client-foundation-v1/dynamic-lib-graph.mjs";
import { canonicalJsonSha256, describeDynamicLibDag } from "../runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs";
import { deriveWitPortContracts } from "../runtime/client-foundation-v1/wit-port-contracts.mjs";

const run = promisify(execFile);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = await mkdtemp(path.join(os.tmpdir(), "wasmc-dynamic-lib-dag-"));
const wit = `package wasmc:dynamic-dag-block@0.0.1;
interface blocks {
  source: func(payload: string) -> string;
  unary: func(payload: string) -> string;
  join: func(left: string, right: string) -> string;
}
world graph-block { export blocks; }
`;
const witPath = path.join(root, "shared.wit");
await writeFile(witPath, wit);
const { stdout } = await run("wasm-tools", ["component", "wit", witPath, "--json"]);
const witDocument = JSON.parse(stdout);
const witSha = sha256(Buffer.from(wit));

async function makeProvider(directory, name, marker, fn, delay = 0) {
  const packageRoot = path.join(root, directory);
  await mkdir(packageRoot, { recursive: true });
  const identity = `wasmc:dynamic-dag-${directory}@0.0.1-dev.1`;
  const manifest = deriveWitPortContracts(witDocument, { world: "graph-block", interface: "blocks", function: fn, wit_sha256: witSha });
  const source = `
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation !== "invoke-ports") throw new Error("unsupported operation");
  if (${delay} > 0) await new Promise((resolve) => setTimeout(resolve, ${delay}));
  const inputs = request.inputs;
  const value = ${fn === "join" ? '"J(" + inputs.left + "," + inputs.right + ")"' : `${JSON.stringify(marker)} + "(" + inputs.payload + ")"`};
  return encoder.encode(JSON.stringify({ accepted: true, outputs: { result: value } }));
}`;
  const adapter = Buffer.from(source);
  const descriptor = {
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit", graph_ports: "graph-ports.json",
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 }, lifecycle: "prototype-not-admitted-not-released",
  };
  await writeFile(path.join(packageRoot, "lib.wit"), wit);
  await writeFile(path.join(packageRoot, "graph-ports.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(packageRoot, "native-adapter.mjs"), adapter);
  await writeFile(path.join(packageRoot, "native-boundary.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  const exact = await inspectDynamicLibPackage(packageRoot);
  const port_contracts = { inputs: manifest.inputs, outputs: manifest.outputs };
  return {
    name, root: packageRoot, identity, artifact_sha256: exact.artifact_sha256, wit_contract_sha256: exact.wit_contract_sha256,
    configuration: {}, configuration_sha256: canonicalJsonSha256({}), state_policy: "stateless", state_schema_identity: null,
    port_contracts, port_contracts_sha256: canonicalJsonSha256(port_contracts),
  };
}

const edges = [
  { from: { node: "source", port: "result" }, to: { node: "left", port: "payload" } },
  { from: { node: "source", port: "result" }, to: { node: "right", port: "payload" } },
  { from: { node: "left", port: "result" }, to: { node: "join", port: "left" } },
  { from: { node: "right", port: "result" }, to: { node: "join", port: "right" } },
];
const entrypoint = { input: { node: "source", port: "payload" }, output: { node: "join", port: "result" } };
const request = (expected_revision, blocks, selectedEdges = edges) => ({
  expected_revision, blocks, edges: selectedEdges, entrypoint,
  graph_digest: describeDynamicLibDag({ blocks, edges: selectedEdges, entrypoint }).graph_digest,
});

const boundary = new LibDefinedBoundary();
const graph = new DynamicLibGraph({ boundary });
try {
  const source = await makeProvider("source-v1", "source", "S", "source");
  const left = await makeProvider("left-v1", "left", "L", "unary", 120);
  const left2 = await makeProvider("left-v2", "left", "L2", "unary", 120);
  const right = await makeProvider("right-v1", "right", "R", "unary", 120);
  const join = await makeProvider("join-v1", "join", "unused", "join");
  const blocks = [source, left, right, join];
  const described = describeDynamicLibDag({ blocks, edges, entrypoint });
  assert.deepEqual(described.levels, [["source"], ["left", "right"], ["join"]]);
  assert.equal(described.graph_digest, describeDynamicLibDag({ blocks: [...blocks].reverse(), edges: [...edges].reverse(), entrypoint }).graph_digest);
  assert.throws(() => describeDynamicLibDag({ blocks, edges: [...edges, { from: { node: "join", port: "result" }, to: { node: "source", port: "payload" } }], entrypoint }), /also has an edge producer|cycle/);
  assert.throws(() => describeDynamicLibDag({ blocks, edges: edges.slice(0, -1), entrypoint }), /no producer/);
  const mismatched = { ...right, port_contracts: { inputs: { payload: "0".repeat(64) }, outputs: right.port_contracts.outputs } };
  mismatched.port_contracts_sha256 = canonicalJsonSha256(mismatched.port_contracts);
  assert.throws(() => describeDynamicLibDag({ blocks: [source, left, mismatched, join], edges, entrypoint }), /WIT port contract mismatch/);

  const installed = await graph.apply(request(0, blocks));
  assert.deepEqual({ outcome: installed.outcome, installed: installed.installed, reused: installed.reused }, { outcome: "committed", installed: 4, reused: 0 });
  const started = performance.now();
  assert.deepEqual(await graph.invoke("x"), { revision: 1, value: "J(L(S(x)),R(S(x)))" });
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 105 && elapsed < 210, `parallel DAG level took ${elapsed}ms`);

  const replacement = await graph.apply(request(1, [source, left2, right, join]));
  assert.deepEqual({ installed: replacement.installed, reused: replacement.reused, released: replacement.released }, { installed: 1, reused: 3, released: 1 });
  assert.deepEqual(await graph.invoke("y"), { revision: 2, value: "J(L2(S(y)),R(S(y)))" });

  const forged = { ...left2, port_contracts: { inputs: left2.port_contracts.inputs, outputs: { result: "1".repeat(64) } } };
  forged.port_contracts_sha256 = canonicalJsonSha256(forged.port_contracts);
  const forgedJoin = { ...join, port_contracts: { inputs: { ...join.port_contracts.inputs, left: "1".repeat(64) }, outputs: join.port_contracts.outputs } };
  forgedJoin.port_contracts_sha256 = canonicalJsonSha256(forgedJoin.port_contracts);
  const rolledBack = await graph.apply(request(2, [source, forged, right, forgedJoin]));
  assert.equal(rolledBack.outcome, "rolled-back");
  assert.match(rolledBack.error, /package port contracts mismatch|identity conflicts/);
  assert.deepEqual(await graph.invoke("z"), { revision: 2, value: "J(L2(S(z)),R(S(z)))" });

  await graph.close();
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  console.log(JSON.stringify({
    accepted: true, schema: "wasmc.dynamic-lib-dag-local-qualification/v1", lifecycle: "prototype-local-qualified-not-admitted-not-released",
    topology: "diamond", topological_levels: described.levels, parallel_branch_elapsed_ms: Number(elapsed.toFixed(3)),
    output: "J(L(S(x)),R(S(x)))", one_branch_replacement: true, unchanged_blocks_reused: 3,
    canonical_node_and_edge_order: true, cycle_or_entry_conflict_rejected: true, missing_input_rejected: true,
    incompatible_port_contract_rejected: true, caller_forged_package_port_contract_rejected: true,
    port_contract_source: "wasm-tools-component-wit-json", wasm_tools_observed: (await run("wasm-tools", ["--version"])).stdout.trim(),
    fixed_host_api_changed: false, minimal_cli_changed: false, boundary_counts_after_close: boundary.counts(),
  }));
} finally {
  await graph.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
