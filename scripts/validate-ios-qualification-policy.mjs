import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const policy = JSON.parse(fs.readFileSync("host/platform/ios/qualification-policy.json", "utf8"));
assert.equal(policy.schema, "wasmc.ios-qualification-policy/v1");
assert.deepEqual(policy.primary_target, {
  os: "ios", architecture: "aarch64", environment: "simulator", embedding: "native",
});
assert.equal(policy.release_eligibility_requires_physical_device, false);
assert.equal(policy.admission_eligibility_requires_physical_device, false);
assert.equal(policy.physical_device_receipts.required_for_admission, false);
assert.equal(policy.physical_device_receipts.required_for_release, false);
assert.ok(policy.required_baseline_capabilities.length > 0);
assert.ok(policy.optional_platform_capabilities.includes("bgtaskscheduler-delivery"));
assert.equal(policy.unsupported_optional_routes[0].blocks_baseline, false);

const candidates = fs.readdirSync("libspec", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("wasmc-system-ios-"))
  .map((entry) => path.join("libspec", entry.name, "lib.json"))
  .filter(fs.existsSync)
  .map((candidatePath) => ({ candidatePath, candidate: JSON.parse(fs.readFileSync(candidatePath, "utf8")) }));
const physicalPending = [...new Set(candidates.flatMap(({ candidate }) =>
  (candidate.native?.binding?.pending_gates ?? []).filter((gate) => gate.includes("physical-device"))))].sort();
for (const gate of physicalPending) assert.ok(policy.non_blocking_candidate_pending_gates.includes(gate));
assert.ok(candidates.length > 0);
for (const {candidate} of candidates) assert.equal(candidate.profile, "native");

for (const { candidatePath, candidate } of candidates) {
  for (const gate of candidate.native?.binding?.pending_gates ?? []) {
    if (gate.includes("physical-device")) {
      assert.ok(policy.non_blocking_candidate_pending_gates.includes(gate),
        `${candidatePath}: unclassified physical-device gate ${gate}`);
    }
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: policy.schema,
  primary_target: policy.primary_target,
  release_eligibility_requires_physical_device: false,
  admission_eligibility_requires_physical_device: false,
  ios_candidates_checked: candidates.length,
  non_blocking_physical_gate_names: physicalPending.length,
  unsupported_optional_routes: policy.unsupported_optional_routes.length,
}));
