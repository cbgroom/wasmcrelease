import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");
const libRoot = "libsrc/wasmc-system-ios-background-transfer";
for (const relative of [
  "candidate.json", "lib.wit", "platform/ios/binding.json",
  "platform/ios/Sources/BackgroundTransferProvider.swift",
  "examples/ios-app/project.yml", "examples/ios-app/App/AppDelegate.swift",
  "examples/ios-app/App/BackgroundTransferViewController.swift",
  "examples/ios-app/UITests/BackgroundTransferUITests.swift",
]) assert.ok(fs.statSync(`${libRoot}/${relative}`).size > 0, relative);
execFileSync("wasm-tools", ["component", "wit", `${libRoot}/lib.wit`], { stdio: "ignore" });
const provider = fs.readFileSync(`${libRoot}/platform/ios/Sources/BackgroundTransferProvider.swift`, "utf8");
const uiTest = fs.readFileSync(`${libRoot}/examples/ios-app/UITests/BackgroundTransferUITests.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${libRoot}/candidate.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${libRoot}/platform/ios/binding.json`, "utf8"));
const resolvedProfile = JSON.parse(execFileSync(process.execPath, [
  "host/platform/profile-resolver.mjs", "resolve",
  "host/platform/ios/background-transfer-request.json",
], { encoding: "utf8" }));
const retainedProfile = JSON.parse(fs.readFileSync(
  "host/platform/ios/background-transfer-profile.json", "utf8",
));
assert.equal(candidate.system_binding.implements, "wasmc:system-background-transfer@0.0.1");
assert.equal(binding.identity, "wasmc:system-ios-background-transfer@0.0.1-dev.2");
assert.equal(binding.limits.process_relaunch_delivery_qualified, false);
assert.deepEqual(resolvedProfile, retainedProfile);
assert.equal(retainedProfile.host.required_domain_apis, 0);
assert.match(provider, /URLSessionConfiguration\.background/);
assert.match(provider, /sessionSendsLaunchEvents = true/);
assert.match(provider, /didFinishDownloadingTo/);
assert.match(provider, /data\.write\(to: resultURL, options: \.atomic\)/);
assert.match(provider, /task\.cancel\(\)/);
assert.match(provider, /NSURLErrorCancelled/);
assert.match(uiTest, /XCUIDevice\.shared\.press\(\.home\)/);
assert.doesNotMatch(provider, /BGTaskScheduler/);
assert.equal(fs.existsSync("host/tests/ios-background-transfer"), false);
console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-background-transfer-static-validation/v1",
  fixed_host_domain_apis: 0,
  fixed_host_sha256: fixedHostDigest,
  qualified: candidate.system_binding.lifecycle.qualified,
  admitted: false,
  released: false,
}));
