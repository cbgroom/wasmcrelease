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

const linuxPersistentReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-persistent-v2.json", "utf8"));
assert.equal(linuxPersistentReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v2");
assert.equal(linuxPersistentReceipt.status, "linux-aarch64-persistent-session-qualified-not-admitted-not-released");
assert.equal(linuxPersistentReceipt.admitted, false);
assert.equal(linuxPersistentReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxPersistentReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxPersistentReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxPersistentReceipt.source)) {
  assert.equal(
    digestAt(linuxPersistentReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained persistent Linux qualification source drift`,
  );
}
assert.equal(linuxPersistentReceipt.evidence.status, "PASS");
assert.equal(linuxPersistentReceipt.evidence.persistent_fd_resources, true);
assert.equal(linuxPersistentReceipt.evidence.generation_checked_stale_handle_rejection, true);
assert.equal(linuxPersistentReceipt.evidence.real_ioctl, "TIOCGPTN");
assert.equal(linuxPersistentReceipt.evidence.real_poll, true);
assert.ok(linuxPersistentReceipt.evidence.performance.read_mib_per_second >= linuxPersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxPersistentReceipt.evidence.performance.write_mib_per_second >= linuxPersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxPersistentReceipt.evidence.performance.persistent_speedup >= linuxPersistentReceipt.evidence.performance.minimum_speedup);

const linuxX86PersistentReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-persistent-v2.json", "utf8"));
assert.equal(linuxX86PersistentReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v2");
assert.equal(linuxX86PersistentReceipt.status, "linux-x86_64-persistent-session-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86PersistentReceipt.workflow.run_id, 36299428864);
assert.equal(linuxX86PersistentReceipt.workflow.conclusion, "success");
assert.equal(linuxX86PersistentReceipt.admitted, false);
assert.equal(linuxX86PersistentReceipt.released, false);
for (const revision of [linuxX86PersistentReceipt.implementation_commit, linuxX86PersistentReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86PersistentReceipt.evidence.status, "PASS");
assert.equal(linuxX86PersistentReceipt.evidence.persistent_fd_resources, true);
assert.equal(linuxX86PersistentReceipt.evidence.generation_checked_stale_handle_rejection, true);
assert.equal(linuxX86PersistentReceipt.evidence.real_ioctl, "TIOCGPTN");
assert.equal(linuxX86PersistentReceipt.evidence.real_poll, true);
assert.ok(linuxX86PersistentReceipt.evidence.performance.read_mib_per_second >= linuxX86PersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86PersistentReceipt.evidence.performance.write_mib_per_second >= linuxX86PersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86PersistentReceipt.evidence.performance.persistent_speedup >= linuxX86PersistentReceipt.evidence.performance.minimum_speedup);

const linuxMappedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-mapped-v3.json", "utf8"));
assert.equal(linuxMappedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v3");
assert.equal(linuxMappedReceipt.status, "linux-aarch64-mapped-device-window-qualified-not-admitted-not-released");
assert.equal(linuxMappedReceipt.admitted, false);
assert.equal(linuxMappedReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxMappedReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxMappedReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxMappedReceipt.source)) {
  assert.equal(
    digestAt(linuxMappedReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained mapped Linux qualification source drift`,
  );
}
assert.equal(linuxMappedReceipt.evidence.status, "PASS");
assert.equal(linuxMappedReceipt.evidence.mapped_device_window, true);
assert.equal(linuxMappedReceipt.evidence.mapping_write_read_match, true);
assert.equal(linuxMappedReceipt.evidence.mapping_sync, true);
assert.equal(linuxMappedReceipt.evidence.mapping_bounds_rejection, true);
assert.equal(linuxMappedReceipt.evidence.generation_checked_stale_mapping_rejection, true);
assert.ok(linuxMappedReceipt.evidence.performance.mapping_mib_per_second >= linuxMappedReceipt.evidence.performance.minimum_mib_per_second);

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
  retained_linux_aarch64_persistent_qualification: linuxPersistentReceipt.implementation_commit,
  retained_linux_x86_64_persistent_qualification: linuxX86PersistentReceipt.qualified_commit,
  retained_linux_aarch64_mapped_qualification: linuxMappedReceipt.implementation_commit,
  old_candidate_rejects_product_drift: true,
  lifecycle: "architecture-workstream-not-admitted-not-released",
}));
