import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux native-boundary qualification must run on Linux");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "target/lib-defined-boundary-linux");
const sourceRoot = path.join(root, "libsrc/wasmc-system-linux-endpoint");
const manifest = path.join(root, "host/runtime/lib-boundary/native-linux/Cargo.toml");
const rustSource = path.join(root, "host/runtime/lib-boundary/native-linux/src/main.rs");
const adapterSource = path.join(sourceRoot, "native-adapter.c");
const adapter = path.join(target, "libwasmc_system_linux_endpoint.so");
const descriptorPath = path.join(target, "native-boundary.json");
const executor = path.join(target, "cargo/release/wasmc-lib-boundary-native-linux");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (relative) => fs.readFileSync(relative);
const command = (program, args, options = {}) =>
  execFileSync(program, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const rustToolchain = process.env.WASMC_RUST_TOOLCHAIN ?? "+1.96.0";
const rustArgs = (args) => rustToolchain ? [rustToolchain, ...args] : args;

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
command("cc", ["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror", adapterSource, "-o", adapter]);
command("cargo", rustArgs(["fmt", "--check", "--manifest-path", manifest]));
command("cargo", rustArgs(["clippy", "--locked", "--manifest-path", manifest, "--all-targets", "--", "-D", "warnings"]));
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", manifest]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "cargo") },
});

const adapterSha256 = hash(read(adapter));
const descriptorTemplate = fs.readFileSync(path.join(sourceRoot, "native-boundary.template.json"), "utf8");
assert.match(descriptorTemplate, /BUILD_OUTPUT_SHA256/);
fs.writeFileSync(descriptorPath, descriptorTemplate.replace("BUILD_OUTPUT_SHA256", adapterSha256));

const encode = (operation, endpoint, value) => {
  const endpointBytes = Buffer.from(endpoint);
  const payload = Buffer.isBuffer(value) ? value : Buffer.alloc(0);
  const requested = Number.isInteger(value) ? value : payload.length;
  const bytes = Buffer.alloc(9 + endpointBytes.length + payload.length);
  bytes.writeUInt8(operation, 0);
  bytes.writeUInt32LE(endpointBytes.length, 1);
  bytes.writeUInt32LE(requested, 5);
  endpointBytes.copy(bytes, 9);
  payload.copy(bytes, 9 + endpointBytes.length);
  return bytes;
};

const invoke = (name, input) => {
  const inputPath = path.join(target, `${name}.input.bin`);
  const outputPath = path.join(target, `${name}.output.bin`);
  fs.writeFileSync(inputPath, input);
  const report = JSON.parse(command(executor, [descriptorPath, inputPath, outputPath]));
  assert.equal(report.accepted, true);
  assert.equal(report.identity, "wasmc:system-linux-endpoint@0.0.1-dev.1");
  assert.equal(report.adapter_sha256, adapterSha256);
  return read(outputPath);
};

const zero = invoke("dev-zero", encode(1, "/dev/zero", 32));
assert.equal(zero.length, 32);
assert.ok(zero.every((byte) => byte === 0));
const nullPayload = Buffer.from("wasmc-linux-dev-null");
const nullResult = invoke("dev-null", encode(2, "/dev/null", nullPayload));
assert.equal(nullResult.length, 8);
assert.equal(Number(nullResult.readBigUInt64LE()), nullPayload.length);
const proc = invoke("proc-self-stat", encode(1, "/proc/self/stat", 4096));
assert.ok(proc.length > 0);
const sys = invoke("sys-cpu-online", encode(1, "/sys/devices/system/cpu/online", 4096));
assert.match(sys.toString("utf8"), /^\d/);

const exports = command("nm", ["-D", "--defined-only", adapter]);
assert.match(exports, /\bwasmc_boundary_v1_invoke\b/);
const rustText = fs.readFileSync(rustSource, "utf8");
for (const forbidden of ["/dev/", "/proc/", "/sys/", "O_RDONLY", "O_WRONLY", "read-endpoint", "write-endpoint"]) {
  assert.equal(rustText.includes(forbidden), false, `domain or Linux endpoint semantics leaked into fixed executor: ${forbidden}`);
}
const adapterText = fs.readFileSync(adapterSource, "utf8");
for (const forbidden of ["/dev/", "/proc/", "/sys/"]) {
  assert.equal(adapterText.includes(forbidden), false, `device selection leaked into generic Lib adapter: ${forbidden}`);
}

const invalidDescriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
invalidDescriptor.adapter.sha256 = "0".repeat(64);
const invalidDescriptorPath = path.join(target, "invalid-native-boundary.json");
fs.writeFileSync(invalidDescriptorPath, JSON.stringify(invalidDescriptor));
const rejected = spawnSync(executor, [invalidDescriptorPath, path.join(target, "dev-zero.input.bin"), path.join(target, "rejected.bin")], {
  cwd: root,
  encoding: "utf8",
});
assert.notEqual(rejected.status, 0);
assert.match(`${rejected.stdout}\n${rejected.stderr}`, /adapter identity mismatch/);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.linux-lib-defined-boundary-qualification/v1",
  platform: process.platform,
  architecture: process.arch,
  kernel: os.release(),
  rustc: command("rustc", rustArgs(["--version"])).trim(),
  executor_sha256: hash(read(executor)),
  adapter_sha256: adapterSha256,
  exported_symbols: ["wasmc_boundary_v1_invoke"],
  fixed_executor_domain_apis: 0,
  adapter_device_path_literals: 0,
  real_linux_endpoints: {
    dev_zero: true,
    dev_null: true,
    proc_self_stat: true,
    sys_cpu_online: true,
  },
  adapter_identity_rejection: true,
  lifecycle: "prototype-qualified-on-this-linux-not-admitted-not-released",
}));
