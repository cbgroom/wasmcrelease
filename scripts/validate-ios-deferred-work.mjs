import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");
const libRoot = "libspec/wasmc-system-ios-deferred-work";
for (const relative of [
  "lib.json", "lib.wit", "platform/ios/binding.json",
  "platform/ios/Sources/DeferredWorkProvider.swift", "examples/ios-app/project.yml",
  "examples/ios-app/App/AppDelegate.swift", "examples/ios-app/App/DeferredWorkViewController.swift",
  "examples/ios-app/UITests/DeferredWorkUITests.swift",
]) assert.ok(fs.statSync(relative.startsWith("examples/") ? `tests/lib-refresh/native/wasmc-system-ios-deferred-work/${relative}` : `${libRoot}/${relative}`).size > 0, relative);
execFileSync("wasm-tools", ["component", "wit", `${libRoot}/lib.wit`], { stdio: "ignore" });
const provider = fs.readFileSync(`${libRoot}/platform/ios/Sources/DeferredWorkProvider.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${libRoot}/lib.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${libRoot}/platform/ios/binding.json`, "utf8"));
assert.equal(candidate.native.binding.implements, "wasmc:system-deferred-work@0.0.1");
assert.equal(binding.identity, "wasmc:system-ios-deferred-work@0.0.1-dev.1");
assert.equal(binding.limits.system_delivery_qualified, false);
assert.match(provider, /BGTaskScheduler\.shared\.register/);
assert.match(provider, /BGAppRefreshTaskRequest/);
assert.match(provider, /getPendingTaskRequests/);
assert.match(provider, /cancel\(taskRequestWithIdentifier/);
assert.doesNotMatch(provider, /_simulateLaunchForTaskWithIdentifier/);
console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-deferred-work-static-validation/v1",
  fixed_host_domain_apis: 0,
  fixed_host_sha256: fixedHostDigest,
  qualified: false,
  admitted: false,
  released: false,
}));
