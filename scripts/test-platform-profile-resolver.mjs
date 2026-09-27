import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ProfileResolutionError,
  loadSystemLibCandidate,
  resolveSystemProfile,
  resolveSystemProfileRequest,
} from "../host/platform/profile-resolver.mjs";

const root = process.cwd();
const requestPath = "host/platform/android/agent-computer-request.json";
const profilePath = "host/platform/android/agent-computer-profile.json";
const request = JSON.parse(fs.readFileSync(path.join(root, requestPath), "utf8"));
const expectedProfile = JSON.parse(fs.readFileSync(path.join(root, profilePath), "utf8"));
const candidates = request.candidates.map((candidate) => loadSystemLibCandidate(root, candidate));

const expectCode = (code, operation) => assert.throws(operation, (error) => {
  assert.ok(error instanceof ProfileResolutionError);
  assert.equal(error.code, code);
  return true;
});

assert.deepEqual(resolveSystemProfileRequest(root, request), expectedProfile);
assert.equal(expectedProfile.schema, "wasmc.library-os-profile/v2");
assert.equal(expectedProfile.host.required_domain_apis, 0);
assert.deepEqual(expectedProfile.bindings.map((binding) => binding.api), expectedProfile.requirements);
assert.equal(expectedProfile.bindings.every((binding) => binding.lifecycle.qualified), true);
assert.equal(expectedProfile.bindings.every((binding) => !binding.lifecycle.admitted), true);

const cli = spawnSync(process.execPath, [
  "host/platform/profile-resolver.mjs", "resolve", requestPath,
], { cwd: root, encoding: "utf8" });
assert.equal(cli.status, 0, cli.stderr);
assert.deepEqual(JSON.parse(cli.stdout), expectedProfile);
assert.equal(cli.stdout, fs.readFileSync(path.join(root, profilePath), "utf8"));

for (const target of [
  { os: "macos", architecture: "aarch64", environment: "device", embedding: "native" },
  { os: "windows", architecture: "x86_64", environment: "device", embedding: "native" },
  { os: "ios", architecture: "aarch64", environment: "device", embedding: "native" },
  { os: "ios", architecture: "aarch64", environment: "simulator", embedding: "native" },
  { os: "android", architecture: "aarch64", environment: "device", embedding: "native" },
]) {
  expectCode("provider.none", () => resolveSystemProfile({ ...request, target }, candidates));
}

expectCode("provider.none", () => resolveSystemProfile({
  ...request,
  required_lifecycle: "admitted",
}, candidates));
expectCode("provider.none", () => resolveSystemProfile({
  ...request,
  boundary: "wasmc.lib-defined-host-boundary/v2",
}, candidates));
expectCode("request.requirement_duplicate", () => resolveSystemProfile({
  ...request,
  requirements: [request.requirements[0], request.requirements[0]],
}, candidates));

const display = candidates[0];
const alternativeDisplay = {
  ...structuredClone(display),
  provider: "vendor:alternate-android-display@1.0.0",
};
expectCode("provider.ambiguous", () => resolveSystemProfile({
  ...request,
  requirements: [display.api],
}, [display, alternativeDisplay]));
const pinned = resolveSystemProfile({
  ...request,
  requirements: [display.api],
  pins: { [display.api]: alternativeDisplay.provider },
}, [display, alternativeDisplay]);
assert.equal(pinned.bindings[0].provider, alternativeDisplay.provider);
expectCode("provider.pin_unmatched", () => resolveSystemProfile({
  ...request,
  requirements: [display.api],
  pins: { [display.api]: "vendor:missing@1.0.0" },
}, [display]));
expectCode("provider.identity_duplicate", () => resolveSystemProfile({
  ...request,
  requirements: [display.api],
}, [display, structuredClone(display)]));

const neutralNamedProvider = {
  ...structuredClone(display),
  provider: "vendor:opaque-provider@1.0.0",
};
const metadataSelected = resolveSystemProfile({
  ...request,
  requirements: [display.api],
}, [neutralNamedProvider]);
assert.equal(metadataSelected.bindings[0].provider, neutralNamedProvider.provider);
assert.deepEqual(metadataSelected.bindings[0].target, request.target);

expectCode("target.invalid", () => resolveSystemProfile({
  ...request,
  target: { os: "android", architecture: "aarch64" },
}, candidates));
expectCode("package.path_invalid", () => loadSystemLibCandidate(root, "../candidate.json"));

console.log(JSON.stringify({
  accepted: true,
  schema: expectedProfile.schema,
  target: expectedProfile.target,
  resolved_bindings: expectedProfile.bindings.length,
  provider_name_inference: false,
  ambiguous_provider_rejection: true,
  missing_platform_rejections: 5,
  lifecycle_fail_closed: true,
  host_domain_apis: expectedProfile.host.required_domain_apis,
}));
