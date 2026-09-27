import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const run = (script) => execFileSync(process.execPath, [script], { encoding: "utf8" }).trim();
const focused = [
  "scripts/validate-host-layout.mjs",
  "scripts/test-host-lib-defined-boundary.mjs",
  "scripts/validate-host-camera-model.mjs",
  "scripts/validate-release-surfaces.mjs",
  "scripts/test-lib-defined-boundary-runtime.mjs",
  "scripts/validate-libsrc.mjs",
];
for (const script of focused) run(script);

const frozenIdentityFiles = [
  "release.json",
  "channels/prod.json",
  "channels/candidates/0.0.15.json",
];
for (const relative of frozenIdentityFiles) {
  const tagged = execFileSync("git", ["show", `v0.0.15:${relative}`]);
  const current = fs.readFileSync(relative);
  assert.deepEqual(current, tagged, `${relative} must remain byte-identical to v0.0.15`);
}

const receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/local-qualification.json", "utf8"));
assert.equal(receipt.schema, "wasmc.host-lib-defined-boundary-local-qualification/v1");
assert.equal(receipt.status, "local-node-qualified-not-admitted-not-released");
assert.equal(receipt.admitted, false);
assert.equal(receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", receipt.implementation_commit, "HEAD"]);
const digest = (relative) => createHash("sha256").update(fs.readFileSync(relative)).digest("hex");
const digestAt = (revision, relative) => createHash("sha256")
  .update(execFileSync("git", ["show", `${revision}:${relative}`]))
  .digest("hex");
assert.equal(digest(receipt.executor.path), receipt.executor.sha256);
for (const lib of receipt.system_libs) {
  assert.equal(digest(`${lib.root}/lib.wit`), lib.wit_sha256);
  assert.equal(digest(`${lib.root}/native-boundary.json`), lib.descriptor_sha256);
  assert.equal(digest(`${lib.root}/native-adapter.mjs`), lib.adapter_sha256);
}
assert.equal(receipt.evidence.status, "PASS");
assert.equal(receipt.evidence.unchanged_executor_domains, 3);
assert.deepEqual(receipt.evidence.final_counts, { resources: 0, windows: 0, operations: 0 });

const linuxReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-qualification.json", "utf8"));
assert.equal(linuxReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v1");
assert.equal(linuxReceipt.status, "linux-aarch64-local-qualified-not-admitted-not-released");
assert.equal(linuxReceipt.admitted, false);
assert.equal(linuxReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxReceipt.source)) {
  assert.equal(
    digestAt(linuxReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained Linux qualification source drift`,
  );
}
assert.equal(linuxReceipt.evidence.status, "PASS");
assert.equal(linuxReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxReceipt.evidence.adapter_device_path_literals, 0);
assert.deepEqual(linuxReceipt.evidence.real_linux_endpoints, {
  dev_zero: true,
  dev_null: true,
  proc_self_stat: true,
  sys_cpu_online: true,
});
assert.equal(linuxReceipt.evidence.adapter_identity_rejection, true);

const linuxX86Receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-qualification.json", "utf8"));
assert.equal(linuxX86Receipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v1");
assert.equal(linuxX86Receipt.status, "linux-x86_64-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86Receipt.workflow.run_id, 36298739381);
assert.equal(linuxX86Receipt.workflow.conclusion, "success");
assert.equal(linuxX86Receipt.admitted, false);
assert.equal(linuxX86Receipt.released, false);
for (const revision of [linuxX86Receipt.implementation_commit, linuxX86Receipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86Receipt.evidence.status, "PASS");
assert.equal(linuxX86Receipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86Receipt.evidence.adapter_device_path_literals, 0);
assert.deepEqual(linuxX86Receipt.evidence.real_linux_endpoints, linuxReceipt.evidence.real_linux_endpoints);
assert.equal(linuxX86Receipt.evidence.adapter_identity_rejection, true);

const oldCandidate = spawnSync(
  process.execPath,
  ["scripts/release-candidate.mjs", "verify", "channels/candidates/0.0.15.json"],
  { encoding: "utf8" },
);
assert.notEqual(oldCandidate.status, 0, "old v0.0.15 candidate must reject future Host architecture bytes");
assert.match(`${oldCandidate.stdout}\n${oldCandidate.stderr}`, /product drift rejected/);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.host-lib-defined-boundary-workstream/v1",
  focused_checks: focused.length,
  frozen_identity_files: frozenIdentityFiles.length,
  retained_local_qualification: receipt.implementation_commit,
  retained_linux_aarch64_qualification: linuxReceipt.implementation_commit,
  retained_linux_x86_64_qualification: linuxX86Receipt.qualified_commit,
  old_candidate_rejects_product_drift: true,
  lifecycle: "architecture-workstream-not-admitted-not-released",
}));
