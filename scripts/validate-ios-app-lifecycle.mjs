import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");

const libRoot = "libsrc/wasmc-system-ios-app-lifecycle";
const exampleRoot = `${libRoot}/examples/ios-app`;
for (const relative of [
  "candidate.json",
  "lib.wit",
  "platform/ios/binding.json",
  "platform/ios/Sources/AppLifecycleProvider.swift",
  "examples/ios-app/project.yml",
  "examples/ios-app/App/AppDelegate.swift",
  "examples/ios-app/App/LifecycleViewController.swift",
  "examples/ios-app/UITests/AppLifecycleUITests.swift",
]) assert.ok(fs.statSync(`${libRoot}/${relative}`).size > 0, relative);
assert.ok(fs.statSync("scripts/test-ios-finite-background-window.mjs").size > 0);
assert.ok(fs.statSync("scripts/probe-ios-finite-background-window-matrix.mjs").size > 0);

execFileSync("wasm-tools", ["component", "wit", `${libRoot}/lib.wit`], { stdio: "ignore" });
const provider = fs.readFileSync(`${libRoot}/platform/ios/Sources/AppLifecycleProvider.swift`, "utf8");
const app = fs.readFileSync(`${exampleRoot}/App/AppDelegate.swift`, "utf8");
const uiTest = fs.readFileSync(`${exampleRoot}/UITests/AppLifecycleUITests.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${libRoot}/candidate.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${libRoot}/platform/ios/binding.json`, "utf8"));
const resolvedProfile = JSON.parse(execFileSync(process.execPath, [
  "host/platform/profile-resolver.mjs", "resolve",
  "host/platform/ios/app-lifecycle-request.json",
], { encoding: "utf8" }));
const retainedProfile = JSON.parse(fs.readFileSync(
  "host/platform/ios/app-lifecycle-profile.json", "utf8",
));

assert.equal(candidate.system_binding.implements, "wasmc:system-app-lifecycle@0.0.1");
assert.equal(candidate.system_binding.artifact_format, "embedded-source");
assert.equal(binding.schema, "wasmc.platform-binding-descriptor/v1");
assert.equal(binding.identity, "wasmc:system-ios-app-lifecycle@0.0.1-dev.1");
assert.equal(binding.artifact.format, "embedded-source");
assert.equal(binding.limits.system_scheduling_guaranteed, false);
assert.deepEqual(resolvedProfile, retainedProfile);
assert.equal(retainedProfile.host.required_domain_apis, 0);
assert.match(provider, /beginBackgroundTask/);
assert.match(provider, /did-enter-background/);
assert.match(provider, /finite-work-completed/);
assert.match(provider, /backgroundTimeRemaining/);
assert.match(provider, /handle\.synchronize\(\)/);
assert.match(app, /applicationDidEnterBackground/);
assert.match(app, /applicationWillEnterForeground/);
assert.match(uiTest, /XCUIDevice\.shared\.press\(\.home\)/);
assert.match(uiTest, /app\.terminate\(\)/);
assert.doesNotMatch(provider, /BGTaskScheduler|URLSession/);
assert.equal(fs.existsSync("host/tests/ios-app-lifecycle"), false);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-app-lifecycle-static-validation/v1",
  fixed_host_domain_apis: 0,
  fixed_host_sha256: fixedHostDigest,
  package_root: libRoot,
  example_root: exampleRoot,
  qualified: candidate.system_binding.lifecycle.qualified,
  admitted: false,
  released: false,
}));
