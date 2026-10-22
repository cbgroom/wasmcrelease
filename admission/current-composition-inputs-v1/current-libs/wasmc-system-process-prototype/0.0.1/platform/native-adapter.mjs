import { spawn } from "node:child_process";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();
const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
const MAX_OUTPUT_LIMIT = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 10 * 60_000;

const fail = (message) => {
  throw new Error(`invalid process request: ${message}`);
};

const decodeRequest = (input) => {
  let request;
  try {
    request = JSON.parse(decoder.decode(input));
  } catch {
    fail("input must be UTF-8 JSON");
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) fail("root must be an object");
  return request;
};

const boundedInteger = (value, fallback, maximum, name) => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail(`${name} is out of range`);
  return value;
};

const environment = (request) => {
  const entries = request.environment ?? [];
  if (!Array.isArray(entries)) fail("environment must be an array");
  const result = request.inherit_environment === false ? {} : { ...process.env };
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string" || typeof entry.value !== "string") {
      fail("environment entries require string name and value");
    }
    if (!entry.name || entry.name.includes("=") || entry.name.includes("\0") || entry.value.includes("\0")) {
      fail("environment entry contains an invalid name or NUL");
    }
    result[entry.name] = entry.value;
  }
  return result;
};

const inputBytes = (request) => {
  if (request.stdin_base64 === undefined) return Buffer.alloc(0);
  if (typeof request.stdin_base64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.stdin_base64)) {
    fail("stdin_base64 must be canonical base64");
  }
  return Buffer.from(request.stdin_base64, "base64");
};

const shellInvocation = (kind, script) => {
  if (typeof script !== "string" || script.includes("\0")) fail("script must be a NUL-free string");
  const selected = kind === "platform-default"
    ? (process.platform === "win32" ? "windows-cmd" : "posix-sh")
    : kind;
  if (selected === "posix-sh") {
    if (process.platform === "win32") fail("posix-sh is unavailable on this platform provider");
    return { executable: "/bin/sh", arguments_: ["-c", script], shell: selected };
  }
  if (selected === "windows-cmd") {
    if (process.platform !== "win32") fail("windows-cmd is unavailable on this platform provider");
    return { executable: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", arguments_: ["/d", "/s", "/c", script], shell: selected };
  }
  if (selected === "windows-powershell") {
    if (process.platform !== "win32") fail("windows-powershell is unavailable on this platform provider");
    return { executable: "powershell.exe", arguments_: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], shell: selected };
  }
  fail(`unsupported shell kind ${JSON.stringify(kind)}`);
};

const capabilities = () => ({
  schema: "wasmc.system-process-capabilities/v1",
  platform: process.platform,
  architecture: process.arch,
  process_execution: true,
  shells: process.platform === "win32"
    ? ["platform-default", "windows-cmd", "windows-powershell"]
    : ["platform-default", "posix-sh"],
  host_api_growth: false,
});

const run = (request, signal) => new Promise((resolve, reject) => {
  let executable;
  let arguments_;
  let selectedShell = null;
  if (request.operation === "process-run") {
    if (typeof request.executable !== "string" || !request.executable || request.executable.includes("\0")) {
      fail("executable must be a non-empty NUL-free string");
    }
    if (!Array.isArray(request.arguments) || request.arguments.some((value) => typeof value !== "string" || value.includes("\0"))) {
      fail("arguments must be NUL-free strings");
    }
    executable = request.executable;
    arguments_ = request.arguments;
  } else if (request.operation === "shell-run") {
    const invocation = shellInvocation(request.shell_kind ?? "platform-default", request.script);
    ({ executable, arguments_, shell: selectedShell } = invocation);
  } else {
    fail("operation must be process-run or shell-run");
  }

  if (request.working_directory !== undefined &&
      (typeof request.working_directory !== "string" || !request.working_directory || request.working_directory.includes("\0"))) {
    fail("working_directory must be a non-empty NUL-free string");
  }
  const timeoutMs = boundedInteger(request.timeout_ms, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, "timeout_ms");
  const outputLimit = boundedInteger(request.max_output_bytes, DEFAULT_OUTPUT_LIMIT, MAX_OUTPUT_LIMIT, "max_output_bytes");
  const started = process.hrtime.bigint();
  let timedOut = false;
  let outputExceeded = false;
  let settled = false;
  const stdout = [];
  const stderr = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;

  const child = spawn(executable, arguments_, {
    cwd: request.working_directory,
    env: environment(request),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    signal,
  });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);

  const collect = (chunks, streamName) => (chunk) => {
    if (streamName === "stdout") stdoutBytes += chunk.length;
    else stderrBytes += chunk.length;
    if (stdoutBytes + stderrBytes > outputLimit) {
      outputExceeded = true;
      child.kill();
      return;
    }
    chunks.push(chunk);
  };
  child.stdout.on("data", collect(stdout, "stdout"));
  child.stderr.on("data", collect(stderr, "stderr"));
  child.once("error", (error) => {
    clearTimeout(timer);
    if (!settled) {
      settled = true;
      reject(error);
    }
  });
  child.once("close", (code, childSignal) => {
    clearTimeout(timer);
    if (settled) return;
    settled = true;
    const elapsedNs = process.hrtime.bigint() - started;
    resolve({
      schema: "wasmc.system-process-result/v1",
      exit_code: Number.isInteger(code) ? code : null,
      signal: childSignal,
      timed_out: timedOut,
      output_limit_exceeded: outputExceeded,
      stdout_base64: Buffer.concat(stdout).toString("base64"),
      stderr_base64: Buffer.concat(stderr).toString("base64"),
      elapsed_ms: Number(elapsedNs / 1_000_000n),
      shell: selectedShell,
    });
  });
  child.stdin.on("error", (error) => {
    if (error.code !== "EPIPE" && !settled) reject(error);
  });
  child.stdin.end(inputBytes(request));
});

export async function invoke(input, { signal }) {
  const request = decodeRequest(input);
  const result = request.operation === "capabilities" ? capabilities() : await run(request, signal);
  return encoder.encode(JSON.stringify(result));
}
