import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertCompositionNegativeControls,
  validateAndMergeComposition,
} from "./system-agent-lab-composition.mjs";
import { resolveSystemProfileRequest } from "../host/platform/profile-resolver.mjs";

const root = process.cwd();
const readJSON = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const manifest = readJSON("examples/system-agent-lab/platform/android/composition.json");
const profile = readJSON(manifest.host.profile);
const request = readJSON("host/platform/android/agent-computer-request.json");
const merged = validateAndMergeComposition(root, manifest, {
  validateBinding: ({ scenario, binding }) => {
    assert.equal(binding.schema, "wasmc.native-boundary-descriptor/v1");
    assert.equal(binding.adapter.path, scenario.artifact);
    assert.equal(binding.adapter.export, "wasmc_boundary_v1_invoke");
  },
});
assert.deepEqual(merged, manifest.expected_merge);
assertCompositionNegativeControls(root, manifest);
assert.deepEqual(profile, resolveSystemProfileRequest(root, request));
assert.deepEqual(manifest.scenarios.map((scenario) => scenario.api), profile.requirements);
assert.deepEqual(manifest.scenarios.map((scenario) => scenario.provider),
  profile.bindings.map((binding) => binding.provider));
assert.deepEqual(manifest.scenarios.map((scenario) => scenario.candidate),
  profile.bindings.map((binding) => binding.candidate));
assert.deepEqual(profile.target, manifest.target);
assert.equal(profile.host.executor, "host/runtime/lib-boundary/native-android");
assert.equal(profile.host.required_domain_apis, 0);
execFileSync(process.execPath, ["scripts/validate-android-agent-computer.mjs"], {
  cwd: root,
  stdio: "ignore",
});
const hostBytes = fs.readFileSync(manifest.host.source);
const hostSHA256 = createHash("sha256").update(hostBytes).digest("hex");

console.log(JSON.stringify({
  accepted: true,
  schema: manifest.schema,
  composition: manifest.id,
  scenarios: manifest.scenarios.length,
  providers: manifest.scenarios.map((scenario) => scenario.provider),
  merged,
  exact_profile_regeneration: true,
  duplicate_provider_rejected: true,
  plist_conflict_rejected: true,
  exclusive_resource_conflict_rejected: true,
  fixed_host_domain_apis: 0,
  fixed_host_sha256: hostSHA256,
  qualified: manifest.lifecycle.qualified,
  admitted: false,
  released: false,
}));

