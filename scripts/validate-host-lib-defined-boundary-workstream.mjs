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

const linuxX86MappedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-mapped-v3.json", "utf8"));
assert.equal(linuxX86MappedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v3");
assert.equal(linuxX86MappedReceipt.status, "linux-x86_64-mapped-device-window-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86MappedReceipt.workflow.run_id, 36300032417);
assert.equal(linuxX86MappedReceipt.workflow.conclusion, "success");
assert.equal(linuxX86MappedReceipt.admitted, false);
assert.equal(linuxX86MappedReceipt.released, false);
for (const revision of [linuxX86MappedReceipt.implementation_commit, linuxX86MappedReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86MappedReceipt.evidence.status, "PASS");
assert.equal(linuxX86MappedReceipt.evidence.mapped_device_window, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_write_read_match, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_sync, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_bounds_rejection, true);
assert.equal(linuxX86MappedReceipt.evidence.generation_checked_stale_mapping_rejection, true);
assert.ok(linuxX86MappedReceipt.evidence.performance.mapping_mib_per_second >= linuxX86MappedReceipt.evidence.performance.minimum_mib_per_second);

const linuxEpollReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-epoll-v4.json", "utf8"));
assert.equal(linuxEpollReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v4");
assert.equal(linuxEpollReceipt.status, "linux-aarch64-epoll-device-readiness-qualified-not-admitted-not-released");
assert.equal(linuxEpollReceipt.admitted, false);
assert.equal(linuxEpollReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxEpollReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxEpollReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxEpollReceipt.source)) {
  assert.equal(
    digestAt(linuxEpollReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained epoll Linux qualification source drift`,
  );
}
assert.equal(linuxEpollReceipt.evidence.status, "PASS");
assert.equal(linuxEpollReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxEpollReceipt.evidence.real_epoll_device_event, true);
assert.equal(linuxEpollReceipt.evidence.epoll_endpoint, "/dev/ptmx");
assert.equal(linuxEpollReceipt.evidence.epoll_add_wait_read_delete, true);
assert.equal(linuxEpollReceipt.evidence.generation_checked_stale_event_set_rejection, true);
assert.equal(linuxEpollReceipt.evidence.fixed_executor_unchanged_from_v3, true);
assert.ok(linuxEpollReceipt.evidence.performance.read_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.write_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.mapping_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.persistent_speedup >= linuxEpollReceipt.evidence.performance.minimum_speedup);

const linuxX86EpollReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-epoll-v4.json", "utf8"));
assert.equal(linuxX86EpollReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v4");
assert.equal(linuxX86EpollReceipt.status, "linux-x86_64-epoll-device-readiness-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86EpollReceipt.workflow.run_id, 36300559026);
assert.equal(linuxX86EpollReceipt.workflow.conclusion, "success");
assert.equal(linuxX86EpollReceipt.admitted, false);
assert.equal(linuxX86EpollReceipt.released, false);
for (const revision of [linuxX86EpollReceipt.implementation_commit, linuxX86EpollReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86EpollReceipt.source)) {
  assert.equal(
    digestAt(linuxX86EpollReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 epoll Linux qualification source drift`,
  );
}
assert.equal(linuxX86EpollReceipt.evidence.status, "PASS");
assert.equal(linuxX86EpollReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86EpollReceipt.evidence.real_epoll_device_event, true);
assert.equal(linuxX86EpollReceipt.evidence.epoll_endpoint, linuxEpollReceipt.evidence.epoll_endpoint);
assert.equal(linuxX86EpollReceipt.evidence.epoll_add_wait_read_delete, true);
assert.equal(linuxX86EpollReceipt.evidence.generation_checked_stale_event_set_rejection, true);
assert.equal(linuxX86EpollReceipt.evidence.fixed_executor_unchanged_from_v3, true);
assert.ok(linuxX86EpollReceipt.evidence.performance.read_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.write_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.mapping_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.persistent_speedup >= linuxX86EpollReceipt.evidence.performance.minimum_speedup);

const linuxSpliceReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-splice-v5.json", "utf8"));
assert.equal(linuxSpliceReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v5");
assert.equal(linuxSpliceReceipt.status, "linux-aarch64-kernel-splice-device-path-qualified-not-admitted-not-released");
assert.equal(linuxSpliceReceipt.admitted, false);
assert.equal(linuxSpliceReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxSpliceReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxSpliceReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxSpliceReceipt.source)) {
  assert.equal(
    digestAt(linuxSpliceReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained splice Linux qualification source drift`,
  );
}
assert.equal(linuxSpliceReceipt.evidence.status, "PASS");
assert.equal(linuxSpliceReceipt.evidence.wit_parsed, true);
assert.equal(linuxSpliceReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxSpliceReceipt.evidence.kernel_splice_device_path, true);
assert.equal(linuxSpliceReceipt.evidence.splice_path, "/dev/zero -> pipe -> /dev/null");
assert.equal(linuxSpliceReceipt.evidence.payload_enters_executor_window, false);
assert.equal(linuxSpliceReceipt.evidence.generation_checked_stale_pipe_rejection, true);
assert.equal(linuxSpliceReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4, true);
assert.ok(linuxSpliceReceipt.evidence.performance.read_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.write_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.mapping_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.splice_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.persistent_speedup >= linuxSpliceReceipt.evidence.performance.minimum_speedup);

const linuxX86SpliceReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-splice-v5.json", "utf8"));
assert.equal(linuxX86SpliceReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v5");
assert.equal(linuxX86SpliceReceipt.status, "linux-x86_64-kernel-splice-device-path-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86SpliceReceipt.workflow.run_id, 36301089197);
assert.equal(linuxX86SpliceReceipt.workflow.conclusion, "success");
assert.equal(linuxX86SpliceReceipt.admitted, false);
assert.equal(linuxX86SpliceReceipt.released, false);
for (const revision of [linuxX86SpliceReceipt.implementation_commit, linuxX86SpliceReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86SpliceReceipt.source)) {
  assert.equal(
    digestAt(linuxX86SpliceReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 splice Linux qualification source drift`,
  );
}
assert.equal(linuxX86SpliceReceipt.evidence.status, "PASS");
assert.equal(linuxX86SpliceReceipt.evidence.wit_parsed, true);
assert.equal(linuxX86SpliceReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86SpliceReceipt.evidence.kernel_splice_device_path, true);
assert.equal(linuxX86SpliceReceipt.evidence.splice_path, linuxSpliceReceipt.evidence.splice_path);
assert.equal(linuxX86SpliceReceipt.evidence.payload_enters_executor_window, false);
assert.equal(linuxX86SpliceReceipt.evidence.generation_checked_stale_pipe_rejection, true);
assert.equal(linuxX86SpliceReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4, true);
assert.ok(linuxX86SpliceReceipt.evidence.performance.read_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.write_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.mapping_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.splice_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.persistent_speedup >= linuxX86SpliceReceipt.evidence.performance.minimum_speedup);

const linuxAsyncReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6.json", "utf8"));
assert.equal(linuxAsyncReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxAsyncReceipt.status, "linux-aarch64-asynchronous-readiness-lifecycle-qualified-not-admitted-not-released");
assert.equal(linuxAsyncReceipt.admitted, false);
assert.equal(linuxAsyncReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxAsyncReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxAsyncReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxAsyncReceipt.source)) {
  assert.equal(
    digestAt(linuxAsyncReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxAsyncReceipt.evidence.status, "PASS");
assert.equal(linuxAsyncReceipt.evidence.wit_parsed, true);
assert.equal(linuxAsyncReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxAsyncReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxAsyncReceipt.evidence.ready, true);
assert.equal(linuxAsyncReceipt.evidence.cancelled, true);
assert.equal(linuxAsyncReceipt.evidence.timed_out, true);
assert.equal(linuxAsyncReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxAsyncReceipt.evidence.pending_release_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.repeated_terminal_cancel_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.retained_endpoint_lifetime, true);
assert.equal(linuxAsyncReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxAsyncReceipt.evidence.generation_checked_stale_operation_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.read_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.write_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.splice_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.persistent_speedup >= linuxAsyncReceipt.evidence.performance_regression.minimum_speedup);

const linuxX86AsyncRejection = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6-compile-rejection.json", "utf8"));
assert.equal(linuxX86AsyncRejection.schema, "wasmc.host-lib-defined-boundary-linux-rejection/v1");
assert.equal(linuxX86AsyncRejection.status, "linux-x86_64-async-readiness-compile-rejected");
assert.equal(linuxX86AsyncRejection.workflow.run_id, 36301745708);
assert.equal(linuxX86AsyncRejection.workflow.conclusion, "failure");
assert.equal(linuxX86AsyncRejection.rejection.stage, "native-adapter-compile");
assert.match(linuxX86AsyncRejection.rejection.diagnostic, /warn_unused_result/);
assert.equal(linuxX86AsyncRejection.qualified, false);
assert.equal(linuxX86AsyncRejection.admitted, false);
assert.equal(linuxX86AsyncRejection.released, false);

const linuxAsyncRemediatedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6-r2.json", "utf8"));
assert.equal(linuxAsyncRemediatedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxAsyncRemediatedReceipt.status, "linux-aarch64-asynchronous-readiness-remediated-qualified-not-admitted-not-released");
assert.equal(linuxAsyncRemediatedReceipt.remediates_rejection_run, linuxX86AsyncRejection.workflow.run_id);
assert.equal(linuxAsyncRemediatedReceipt.admitted, false);
assert.equal(linuxAsyncRemediatedReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxAsyncRemediatedReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxAsyncRemediatedReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxAsyncRemediatedReceipt.source)) {
  assert.equal(
    digestAt(linuxAsyncRemediatedReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained remediated async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxAsyncRemediatedReceipt.evidence.status, "PASS");
assert.equal(linuxAsyncRemediatedReceipt.evidence.cleanup_signal_result_consumed, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxAsyncRemediatedReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.read_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.write_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.splice_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.persistent_speedup >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_speedup);

const linuxX86AsyncReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6.json", "utf8"));
assert.equal(linuxX86AsyncReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxX86AsyncReceipt.status, "linux-x86_64-asynchronous-readiness-remediated-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86AsyncReceipt.remediates_rejection_run, linuxX86AsyncRejection.workflow.run_id);
assert.equal(linuxX86AsyncReceipt.workflow.run_id, 36301909558);
assert.equal(linuxX86AsyncReceipt.workflow.conclusion, "success");
assert.equal(linuxX86AsyncReceipt.admitted, false);
assert.equal(linuxX86AsyncReceipt.released, false);
for (const revision of [linuxX86AsyncReceipt.implementation_commit, linuxX86AsyncReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86AsyncReceipt.source)) {
  assert.equal(
    digestAt(linuxX86AsyncReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxX86AsyncReceipt.evidence.status, "PASS");
assert.equal(linuxX86AsyncReceipt.evidence.strict_compile_remediation, true);
assert.equal(linuxX86AsyncReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxX86AsyncReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxX86AsyncReceipt.evidence.pending_release_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.repeated_terminal_cancel_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.retained_endpoint_lifetime, true);
assert.equal(linuxX86AsyncReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxX86AsyncReceipt.evidence.generation_checked_stale_operation_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.read_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.write_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.splice_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.persistent_speedup >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_speedup);

const linuxDeviceIoReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-device-io-v7.json", "utf8"));
assert.equal(linuxDeviceIoReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v7");
assert.equal(linuxDeviceIoReceipt.status, "linux-aarch64-ioctl-call-shapes-and-vectored-write-qualified-not-admitted-not-released");
assert.equal(linuxDeviceIoReceipt.admitted, false);
assert.equal(linuxDeviceIoReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxDeviceIoReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxDeviceIoReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxDeviceIoReceipt.source)) {
  assert.equal(
    digestAt(linuxDeviceIoReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained device-I/O Linux qualification source drift`,
  );
}
assert.equal(linuxDeviceIoReceipt.evidence.status, "PASS");
assert.equal(linuxDeviceIoReceipt.evidence.fixed_executor_domain_apis, 0);
assert.deepEqual(linuxDeviceIoReceipt.evidence.ioctl_call_shapes, ["none", "value", "buffer"]);
assert.equal(linuxDeviceIoReceipt.evidence.single_syscall_vectored_write, true);
assert.equal(linuxDeviceIoReceipt.evidence.vectored_write_segments, 64);
assert.equal(linuxDeviceIoReceipt.evidence.malformed_vectored_write_rejection, true);
assert.equal(linuxDeviceIoReceipt.evidence.generation_checked_stale_vectored_write_rejection, true);
assert.equal(linuxDeviceIoReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5_v6, true);
for (const state of Object.values(linuxDeviceIoReceipt.evidence.device_backed_gates)) {
  assert.equal(state, "PENDING-NODE-NOT-EXPOSED");
}
assert.ok(linuxDeviceIoReceipt.evidence.performance_regression.vector_write_mib_per_second >= linuxDeviceIoReceipt.evidence.performance_regression.minimum_mib_per_second);

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
  retained_linux_x86_64_mapped_qualification: linuxX86MappedReceipt.qualified_commit,
  retained_linux_aarch64_epoll_qualification: linuxEpollReceipt.implementation_commit,
  retained_linux_x86_64_epoll_qualification: linuxX86EpollReceipt.qualified_commit,
  retained_linux_aarch64_splice_qualification: linuxSpliceReceipt.implementation_commit,
  retained_linux_x86_64_splice_qualification: linuxX86SpliceReceipt.qualified_commit,
  retained_linux_aarch64_async_readiness_qualification: linuxAsyncReceipt.implementation_commit,
  retained_linux_x86_64_async_readiness_rejection: linuxX86AsyncRejection.qualified_commit,
  retained_linux_aarch64_async_readiness_remediated_qualification: linuxAsyncRemediatedReceipt.implementation_commit,
  retained_linux_x86_64_async_readiness_qualification: linuxX86AsyncReceipt.qualified_commit,
  retained_linux_aarch64_device_io_qualification: linuxDeviceIoReceipt.implementation_commit,
  old_candidate_rejects_product_drift: true,
  lifecycle: "architecture-workstream-not-admitted-not-released",
}));
