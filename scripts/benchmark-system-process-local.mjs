import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";

if (process.platform === "win32") {
  throw new Error("local characterization currently requires a POSIX /bin/sh target");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(root, "libspec/wasmc-system-process-prototype");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const now = () => process.hrtime.bigint();
const milliseconds = (start, end = now()) => Number(end - start) / 1_000_000;

const summarize = (samples, totalMs) => {
  const ordered = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
  return {
    samples: ordered.length,
    p50_ms: Number(percentile(0.50).toFixed(6)),
    p95_ms: Number(percentile(0.95).toFixed(6)),
    mean_ms: Number((ordered.reduce((sum, value) => sum + value, 0) / ordered.length).toFixed(6)),
    total_ms: Number(totalMs.toFixed(3)),
    operations_per_second: Number((ordered.length * 1000 / totalMs).toFixed(1)),
  };
};

const boundary = new LibDefinedBoundary();
const resource = await boundary.install(packageRoot);
const invoke = async (request) => {
  const window = boundary.acquireWindow(encoder.encode(JSON.stringify(request)));
  const operation = boundary.submit(resource, window);
  const [state] = await boundary.wait([operation]);
  assert.equal(state.state, "completed");
  const completion = boundary.claim(operation);
  assert.equal(completion.state, "completed");
  const result = JSON.parse(decoder.decode(completion.bytes));
  boundary.releaseOperation(operation);
  boundary.releaseWindow(window);
  return result;
};

const measureBoundary = async (request, warmups, iterations) => {
  for (let index = 0; index < warmups; index += 1) await invoke(request);
  const samples = [];
  const totalStart = now();
  for (let index = 0; index < iterations; index += 1) {
    const start = now();
    const result = await invoke(request);
    assert.equal(result.exit_code ?? 0, 0);
    samples.push(milliseconds(start));
  }
  return summarize(samples, milliseconds(totalStart));
};

const createPersistentShell = () => {
  const child = spawn("/bin/sh", [], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const waiters = new Map();
  let stderr = "";
  let closed = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.once("close", () => {
    closed = true;
    for (const reject of waiters.values()) reject(new Error(`persistent shell closed: ${stderr}`));
    waiters.clear();
  });
  lines.on("line", (line) => {
    const resolve = waiters.get(line);
    if (resolve) {
      waiters.delete(line);
      resolve();
    }
  });
  let sequence = 0;
  const prepare = () => {
    const marker = `WASMC_DONE_${sequence += 1}`;
    const promise = new Promise((resolve, reject) => {
      waiters.set(marker, resolve);
      if (closed) reject(new Error("persistent shell already closed"));
    });
    return { marker, promise };
  };
  const command = (marker) => `:\nprintf '%s\\n' '${marker}'\n`;
  return {
    async exchange() {
      const pending = prepare();
      child.stdin.write(command(pending.marker));
      await pending.promise;
    },
    async pipeline(count) {
      const pending = Array.from({ length: count }, prepare);
      child.stdin.write(pending.map(({ marker }) => command(marker)).join(""));
      await Promise.all(pending.map(({ promise }) => promise));
    },
    async close() {
      const completion = new Promise((resolve) => child.once("close", resolve));
      child.stdin.end("exit\n");
      await completion;
      assert.equal(stderr, "");
    },
  };
};

const persistent = createPersistentShell();
try {
  const genericBoundary = await measureBoundary({ operation: "capabilities" }, 20, 500);
  const directProcess = await measureBoundary({
    operation: "process-run",
    executable: "/usr/bin/true",
    arguments: [],
  }, 5, 80);
  const oneShotShell = await measureBoundary({
    operation: "shell-run",
    shell_kind: "posix-sh",
    script: ":",
  }, 5, 80);

  for (let index = 0; index < 20; index += 1) await persistent.exchange();
  const persistentSamples = [];
  const persistentStart = now();
  for (let index = 0; index < 1_000; index += 1) {
    const start = now();
    await persistent.exchange();
    persistentSamples.push(milliseconds(start));
  }
  const persistentSequential = summarize(persistentSamples, milliseconds(persistentStart));

  const pipelineCount = 5_000;
  const pipelineStart = now();
  await persistent.pipeline(pipelineCount);
  const pipelineTotalMs = milliseconds(pipelineStart);
  const persistentPipelined = {
    operations: pipelineCount,
    total_ms: Number(pipelineTotalMs.toFixed(3)),
    operations_per_second: Number((pipelineCount * 1000 / pipelineTotalMs).toFixed(1)),
  };

  boundary.releaseResource(resource);
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.system-process-local-characterization/v1",
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    workload: "successful-no-op-command-with-observed-completion",
    current_lib_boundary: {
      generic_no_process: genericBoundary,
      one_shot_direct_process: directProcess,
      one_shot_posix_shell: oneShotShell,
    },
    persistent_shell_opportunity_probe: {
      transport: "direct-node-child-process-not-yet-lib-boundary",
      sequential: persistentSequential,
      pipelined: persistentPipelined,
    },
    ratios: {
      one_shot_shell_to_persistent_sequential_p50: Number((oneShotShell.p50_ms / persistentSequential.p50_ms).toFixed(2)),
      one_shot_process_to_persistent_sequential_p50: Number((directProcess.p50_ms / persistentSequential.p50_ms).toFixed(2)),
      persistent_pipeline_to_one_shot_shell_ops: Number((persistentPipelined.operations_per_second / oneShotShell.operations_per_second).toFixed(2)),
    },
    fixed_host_api_growth: false,
    qualification: false,
    admitted: false,
    released: false,
  }));
} finally {
  await persistent.close();
}
