import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const digest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(digest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");
const root = "libsrc/wasmc-system-ios-network-path";
for (const relative of ["candidate.json", "lib.wit", "platform/ios/binding.json",
  "platform/ios/Sources/NetworkPathProvider.swift", "examples/ios-app/project.yml",
  "examples/ios-app/App/AppDelegate.swift", "examples/ios-app/App/Info.plist",
  "examples/ios-app/App/NetworkPathViewController.swift", "examples/ios-app/UITests/NetworkPathUITests.swift"]) {
  assert.ok(fs.statSync(`${root}/${relative}`).size > 0, relative);
}
execFileSync("wasm-tools", ["component", "wit", `${root}/lib.wit`], { stdio: "ignore" });
const provider = fs.readFileSync(`${root}/platform/ios/Sources/NetworkPathProvider.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${root}/candidate.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${root}/platform/ios/binding.json`, "utf8"));
const resolvedProfile = JSON.parse(execFileSync(process.execPath, ["host/platform/profile-resolver.mjs", "resolve",
  "host/platform/ios/network-path-request.json"], { encoding: "utf8" }));
const retainedProfile = JSON.parse(fs.readFileSync("host/platform/ios/network-path-profile.json", "utf8"));
assert.equal(candidate.system_binding.implements, "wasmc:system-network-path@0.0.1");
assert.equal(binding.identity, "wasmc:system-ios-network-path@0.0.1-dev.1");
assert.deepEqual(resolvedProfile, retainedProfile);
assert.equal(retainedProfile.host.required_domain_apis, 0);
assert.match(provider, /NWPathMonitor/);
assert.equal(binding.limits.path_mutation, false);
console.log(JSON.stringify({ accepted: true, schema: "wasmc.ios-network-path-static-validation/v1",
  fixed_host_domain_apis: 0, fixed_host_sha256: digest,
  qualified: candidate.system_binding.lifecycle.qualified, admitted: false, released: false }));
