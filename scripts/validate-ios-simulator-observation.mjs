import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ProfileResolutionError,
  loadSystemLibCandidate,
  resolveSystemProfile,
  resolveSystemProfileRequest,
} from "../host/platform/profile-resolver.mjs";

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const request = readJson("host/platform/ios/simulator-observation-request.json");
const profile = readJson("host/platform/ios/simulator-observation-profile.json");
const candidatePath = "libsrc/wasmc-system-ios-simulator-display/candidate.json";
const candidate = readJson(candidatePath);
const descriptor = readJson("libsrc/wasmc-system-ios-simulator-display/native-boundary.template.json");

assert.deepEqual(resolveSystemProfileRequest(root, request), profile);
assert.deepEqual(profile.target, {
  os: "ios", architecture: "aarch64", environment: "simulator", embedding: "supervisor",
});
assert.equal(profile.host.required_domain_apis, 0);
assert.deepEqual(profile.requirements, ["wasmc:system-display@0.0.1"]);
assert.equal(profile.bindings[0].provider, "wasmc:system-ios-simulator-display@0.0.1-dev.1");
assert.equal(candidate.system_binding.lifecycle.qualified, true);
assert.equal(candidate.admitted, false);
assert.equal(descriptor.lifecycle, "prototype-not-admitted-not-released");

const hostSource = fs.readFileSync("host/runtime/lib-boundary/native-apple-simulator/src/main.rs", "utf8");
for (const forbidden of ["simctl", "screenshot", "com.apple.Preferences", "system-display"]) {
  assert.equal(hostSource.includes(forbidden), false, `domain semantics leaked into fixed supervisor Host: ${forbidden}`);
}
assert.match(hostSource, /wasmc\.native-boundary-descriptor\/v1/);
assert.match(hostSource, /adapter identity mismatch/);
const adapterSource = fs.readFileSync("libsrc/wasmc-system-ios-simulator-display/native-adapter.c", "utf8");
assert.match(adapterSource, /simctl/);
assert.match(adapterSource, /screenshot/);
assert.match(adapterSource, /WASMC_IOS_SIMULATOR_UDID/);
execFileSync("wasm-tools", ["component", "wit", "libsrc/wasmc-system-ios-simulator-display/lib.wit"], {
  cwd: root, stdio: "ignore",
});

const loaded = loadSystemLibCandidate(root, candidatePath);
for (const missingApi of [
  "wasmc:system-ui@0.0.1",
  "wasmc:system-input@0.0.1",
  "wasmc:system-virtual-input@0.0.1",
]) {
  assert.throws(
    () => resolveSystemProfile({ ...request, requirements: [missingApi] }, [loaded]),
    (error) => error instanceof ProfileResolutionError && error.code === "provider.none",
  );
}
assert.throws(
  () => resolveSystemProfile({
    ...request,
    target: { os: "ios", architecture: "aarch64", environment: "device", embedding: "native" },
  }, [loaded]),
  (error) => error instanceof ProfileResolutionError && error.code === "provider.none",
);

console.log(JSON.stringify({
  accepted: true,
  schema: profile.schema,
  target: profile.target,
  fixed_host_domain_apis: 0,
  resolved_bindings: 1,
  missing_agent_capabilities_fail_closed: 3,
  physical_device_fail_closed: true,
  admitted: false,
  released: false,
}));
