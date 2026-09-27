import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");
const libRoot = "libsrc/wasmc-system-ios-local-notification";
for (const relative of ["candidate.json", "lib.wit", "platform/ios/binding.json",
  "platform/ios/Sources/LocalNotificationProvider.swift", "examples/ios-app/project.yml",
  "examples/ios-app/App/AppDelegate.swift", "examples/ios-app/App/Info.plist",
  "examples/ios-app/App/LocalNotificationViewController.swift",
  "examples/ios-app/UITests/LocalNotificationUITests.swift"]) {
  assert.ok(fs.statSync(`${libRoot}/${relative}`).size > 0, relative);
}
execFileSync("wasm-tools", ["component", "wit", `${libRoot}/lib.wit`], { stdio: "ignore" });
const provider = fs.readFileSync(`${libRoot}/platform/ios/Sources/LocalNotificationProvider.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${libRoot}/candidate.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${libRoot}/platform/ios/binding.json`, "utf8"));
const resolvedProfile = JSON.parse(execFileSync(process.execPath, ["host/platform/profile-resolver.mjs", "resolve",
  "host/platform/ios/local-notification-request.json"], { encoding: "utf8" }));
const retainedProfile = JSON.parse(fs.readFileSync("host/platform/ios/local-notification-profile.json", "utf8"));
assert.equal(candidate.system_binding.implements, "wasmc:system-local-notification@0.0.1");
assert.equal(binding.identity, "wasmc:system-ios-local-notification@0.0.1-dev.1");
assert.equal(binding.limits.remote_push, false);
assert.deepEqual(resolvedProfile, retainedProfile);
assert.equal(retainedProfile.host.required_domain_apis, 0);
assert.match(provider, /UNUserNotificationCenter\.current/);
assert.match(provider, /getDeliveredNotifications/);
assert.match(provider, /delivery_between_background_boundaries/);
console.log(JSON.stringify({ accepted: true, schema: "wasmc.ios-local-notification-static-validation/v1",
  fixed_host_domain_apis: 0, fixed_host_sha256: fixedHostDigest,
  qualified: candidate.system_binding.lifecycle.qualified, admitted: false, released: false }));
