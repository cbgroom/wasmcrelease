import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(root, "libsrc/wasmc-system-process-prototype");
const executorPath = path.join(root, "host/runtime/lib-boundary/reference.mjs");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fromBase64 = (value) => Buffer.from(value, "base64").toString("utf8");
const candidate = JSON.parse(await readFile(path.join(packageRoot, "candidate.json"), "utf8"));

const boundary = new LibDefinedBoundary();
const resource = await boundary.install(packageRoot);
const invoke = async (request, expectedState = "completed") => {
  const window = boundary.acquireWindow(encoder.encode(JSON.stringify(request)));
  const operation = boundary.submit(resource, window);
  assert.deepEqual(await boundary.wait([operation]), [{ operation, state: expectedState }]);
  const completion = boundary.claim(operation);
  assert.equal(completion.state, expectedState);
  boundary.releaseOperation(operation);
  boundary.releaseWindow(window);
  if (expectedState === "failed") return completion.error;
  assert.ok(completion.bytes);
  return JSON.parse(decoder.decode(completion.bytes));
};

const temporary = await mkdtemp(path.join(os.tmpdir(), "wasmc-system-process-"));
try {
  const capabilities = await invoke({ operation: "capabilities" });
  assert.equal(capabilities.platform, process.platform);
  assert.equal(capabilities.architecture, process.arch);
  assert.equal(capabilities.process_execution, true);
  assert.equal(capabilities.host_api_growth, false);

  const directArgument = "literal;$(not-a-shell)&|<>";
  const direct = await invoke({
    operation: "process-run",
    executable: process.execPath,
    arguments: [
      "-e",
      "const fs=require('node:fs');const input=fs.readFileSync(0,'utf8');process.stdout.write(JSON.stringify({arg:process.argv[1],env:process.env.WASMC_PROCESS_TEST,cwd:process.cwd(),input}));process.stderr.write('direct-stderr');",
      directArgument,
    ],
    working_directory: temporary,
    environment: [{ name: "WASMC_PROCESS_TEST", value: "environment-ok" }],
    inherit_environment: true,
    stdin_base64: Buffer.from("stdin-ok").toString("base64"),
    timeout_ms: 5_000,
    max_output_bytes: 64 * 1024,
  });
  assert.equal(direct.exit_code, 0);
  assert.equal(direct.shell, null);
  assert.equal(fromBase64(direct.stderr_base64), "direct-stderr");
  const canonicalTemporary = await realpath(temporary);
  const directPayload = JSON.parse(fromBase64(direct.stdout_base64));
  assert.equal(directPayload.arg, directArgument);
  assert.equal(directPayload.env, "environment-ok");
  assert.equal(await realpath(directPayload.cwd), canonicalTemporary);
  assert.equal(directPayload.input, "stdin-ok");

  const nonzero = await invoke({
    operation: "process-run",
    executable: process.execPath,
    arguments: ["-e", "process.stdout.write('nonzero-out');process.stderr.write('nonzero-err');process.exit(7)"],
  });
  assert.equal(nonzero.exit_code, 7);
  assert.equal(fromBase64(nonzero.stdout_base64), "nonzero-out");
  assert.equal(fromBase64(nonzero.stderr_base64), "nonzero-err");

  const defaultShellScript = process.platform === "win32"
    ? "@echo shell-out&@echo shell-err>&2&exit /b 11"
    : "printf shell-out; printf shell-err >&2; exit 11";
  const shell = await invoke({
    operation: "shell-run",
    shell_kind: "platform-default",
    script: defaultShellScript,
  });
  assert.equal(shell.exit_code, 11);
  assert.equal(shell.shell, process.platform === "win32" ? "windows-cmd" : "posix-sh");
  assert.equal(fromBase64(shell.stdout_base64), process.platform === "win32" ? "shell-out\r\n" : "shell-out");
  assert.equal(fromBase64(shell.stderr_base64), process.platform === "win32" ? "shell-err\r\n" : "shell-err");

  let powershell = null;
  if (process.platform === "win32") {
    powershell = await invoke({
      operation: "shell-run",
      shell_kind: "windows-powershell",
      script: "[Console]::Out.Write('powershell-out'); [Console]::Error.Write('powershell-err'); exit 13",
    });
    assert.equal(powershell.exit_code, 13);
    assert.equal(fromBase64(powershell.stdout_base64), "powershell-out");
    assert.equal(fromBase64(powershell.stderr_base64), "powershell-err");
  }

  const timed = await invoke({
    operation: "process-run",
    executable: process.execPath,
    arguments: ["-e", "setTimeout(()=>{},5000)"],
    timeout_ms: 100,
  });
  assert.equal(timed.timed_out, true);
  assert.ok(timed.elapsed_ms < 4_000, `timeout took ${timed.elapsed_ms}ms`);

  const bounded = await invoke({
    operation: "process-run",
    executable: process.execPath,
    arguments: ["-e", "process.stdout.write('x'.repeat(65536))"],
    max_output_bytes: 1024,
  });
  assert.equal(bounded.output_limit_exceeded, true);

  const unsupportedShell = process.platform === "win32" ? "posix-sh" : "windows-cmd";
  const rejected = await invoke({
    operation: "shell-run",
    shell_kind: unsupportedShell,
    script: "exit 0",
  }, "failed");
  assert.match(rejected, /unavailable on this platform provider/);

  boundary.releaseResource(resource);
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.system-process-shell-qualification/v2",
    candidate: "wasmc-system-process-prototype",
    version: candidate.version,
    platform: process.platform,
    architecture: process.arch,
    provider: "wasmc:system-process-node@0.0.1-dev.2",
    process_argv_literal: true,
    cwd_environment_stdin: true,
    stdout_stderr_exit_code: true,
    default_shell: shell.shell,
    windows_powershell: powershell !== null,
    timeout_enforced: true,
    output_limit_enforced: true,
    unsupported_shell_fail_closed: true,
    fixed_executor_sha256: sha256(await readFile(executorPath)),
    host_api_growth: false,
    qualified: candidate.system_binding.lifecycle.qualified,
    admitted: candidate.system_binding.lifecycle.admitted,
    released: false,
  }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
