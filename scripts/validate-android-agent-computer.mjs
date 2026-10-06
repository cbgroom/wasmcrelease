import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const profile = readJson("host/platform/android/agent-computer-profile.json");
const architecture = readJson("host/architecture.json");

assert.equal(profile.schema, "wasmc.library-os-profile/v3");
assert.deepEqual(profile.target, {
  os: "android",
  architecture: "aarch64",
  environment: "emulator",
  embedding: "native",
});
assert.equal(profile.host.contract, "wasmc.lib-defined-host-boundary/v1");
assert.equal(profile.host.executor, "host/runtime/lib-boundary/native-android");
assert.equal(profile.host.required_domain_apis, 0);
assert.equal(profile.required_lifecycle, "source");
assert.deepEqual(profile.requirements, [
  "wasmc:system-display@0.0.1",
  "wasmc:system-ui@0.0.1",
  "wasmc:system-input@0.0.1",
  "wasmc:system-virtual-input@0.0.1",
]);

const native = architecture.prototype?.android_native;
assert.equal(native?.profile, "host/platform/android/agent-computer-profile.json");
assert.equal(native?.executor, profile.host.executor);
assert.equal(native?.system_libs?.length, 4);
assert.ok(native?.status?.endsWith("not-admitted-not-released"));
assert.equal(profile.executable, false);

const hostSource = fs.readFileSync(path.join(root, profile.host.executor, "src/main.rs"), "utf8");
for (const forbidden of [
  "/system/bin/screencap",
  "/system/bin/uiautomator",
  "/system/bin/input",
  "/dev/uinput",
  "UI_DEV_CREATE",
  "SurfaceFlinger",
  "keyevent",
]) {
  assert.equal(hostSource.includes(forbidden), false, `domain semantics leaked into Android Host: ${forbidden}`);
}
assert.match(hostSource, /wasmc\.native-boundary-descriptor\/v1/);
assert.match(hostSource, /adapter identity mismatch/);

const specs = [
  ["display", "wasmc-system-android-display", "/system/bin/screencap"],
  ["ui", "wasmc-system-android-ui", "/system/bin/uiautomator"],
  ["input", "wasmc-system-android-input", "/system/bin/input"],
  ["uinput", "wasmc-system-android-uinput", "/dev/uinput"],
];
for (const [name, id, platformMechanism] of specs) {
  const relative = `libspec/${id}`;
  const candidate = readJson(`${relative}/lib.json`);
  const descriptor = readJson(`${relative}/platform/native-boundary.template.json`);
  assert.equal(candidate.schema, "wasmc.lib-refresh-source/v2");
  assert.equal(candidate.id, id);
  assert.equal(candidate.profile, "native");
  assert.equal(candidate.native.target, "android");
  assert.ok(candidate.native.files.includes(candidate.native.entry));
  assert.equal(descriptor.schema, "wasmc.native-boundary-descriptor/v1");
  assert.equal(descriptor.identity, `wasmc:system-android-${name}@0.0.1-dev.1`);
  assert.equal(descriptor.adapter.sha256, "BUILD_OUTPUT_SHA256");
  assert.equal(descriptor.lifecycle, "prototype-not-admitted-not-released");
  const adapter = fs.readFileSync(path.join(root, relative, "platform/native-adapter.c"), "utf8");
  assert.ok(adapter.includes(platformMechanism), `${id}: missing Lib-owned platform binding`);
  execFileSync("wasm-tools", ["component", "wit", path.join(relative, "lib.wit")], {
    cwd: root,
    stdio: "ignore",
  });
}

assert.deepEqual(profile.bindings.map((binding) => binding.api), profile.requirements);
assert.deepEqual(
  profile.bindings.map((binding) => binding.provider),
  specs.map(([name]) => `wasmc:system-android-${name}@0.0.1-dev.1`),
);
for (const binding of profile.bindings) {
  assert.deepEqual(binding.target, profile.target);
  assert.equal(binding.boundary, profile.host.contract);
  assert.equal(binding.lifecycle.source, true);
  assert.equal(binding.lifecycle.admitted, false);
  assert.equal(binding.lifecycle.released, false);
}
console.log(JSON.stringify({
  accepted: true,
  schema: profile.schema,
  target: profile.target,
  fixed_host_domain_apis: profile.host.required_domain_apis,
  standard_apis: profile.requirements.length,
  android_bindings: profile.bindings.length,
  admitted: false,
  released: false,
}));
