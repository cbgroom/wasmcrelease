import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const expected = new Map([
  ["wasmc:system-ios-app-storage@0.0.1-dev.1", "wasmc:system-app-storage@0.0.1"],
  ["wasmc:system-ios-app-state@0.0.1-dev.1", "wasmc:system-app-state@0.0.1"],
  ["wasmc:system-ios-app-network@0.0.1-dev.1", "wasmc:system-app-network@0.0.1"],
  ["wasmc:system-ios-app-ui@0.0.1-dev.1", "wasmc:system-ui@0.0.1"],
  ["wasmc:system-ios-app-display@0.0.1-dev.1", "wasmc:system-display@0.0.1"],
  ["wasmc:system-ios-app-metal@0.0.1-dev.1", "wasmc:system-app-accelerator@0.0.1"],
  ["wasmc:system-ios-app-database@0.0.1-dev.1", "wasmc:system-app-database@0.0.1"],
  ["wasmc:system-ios-app-crypto@0.0.1-dev.1", "wasmc:system-app-crypto@0.0.1"],
  ["wasmc:system-ios-app-audio@0.0.1-dev.1", "wasmc:system-app-audio@0.0.1"],
  ["wasmc:system-ios-app-web@0.0.1-dev.1", "wasmc:system-app-web@0.0.1"],
  ["wasmc:system-ios-app-device-observation@0.0.1-dev.1", "wasmc:system-app-device-observation@0.0.1"],
  ["wasmc:system-ios-app-authorization@0.0.1-dev.2", "wasmc:system-app-authorization@0.0.1"],
  ["wasmc:system-ios-app-contacts@0.0.1-dev.1", "wasmc:system-app-contacts@0.0.1"],
]);
const host = fs.readFileSync("host/tests/ios-app-capability/Host/FixedHost.swift", "utf8");
const profile = fs.readFileSync("host/tests/ios-app-capability/Profile/EmbeddedProfile.swift", "utf8");
const app = fs.readFileSync("host/tests/ios-app-capability/Host/AppDelegate.swift", "utf8");

for (const forbidden of ["UIKit", "Security", "Metal", "storage", "network", "keychain", "display", "ui@", "accelerator"]) {
  assert.equal(host.toLowerCase().includes(forbidden.toLowerCase()), false,
    `domain semantics leaked into fixed embedded Host: ${forbidden}`);
}
assert.match(host, /maxInputBytes/);
assert.match(host, /maxOutputBytes/);
assert.match(host, /duplicateIdentity/);
assert.match(host, /SHA256\.hash/);
assert.equal(createHash("sha256").update(host).digest("hex"),
  "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f",
  "app capability growth must not change the fixed embedded Host");
assert.match(app, /applicationDidBecomeActive/);
assert.equal((profile.match(/\.init\(/g) ?? []).length, expected.size);
for (const [identity, witPackage] of expected) {
  assert.ok(profile.includes(identity), `missing provider ${identity}`);
  assert.ok(profile.includes(witPackage), `missing WIT package ${witPackage}`);
}

const witFiles = [
  "host/tests/ios-app-capability/WIT/app-storage.wit",
  "host/tests/ios-app-capability/WIT/app-state.wit",
  "host/tests/ios-app-capability/WIT/app-network.wit",
  "host/tests/ios-app-capability/WIT/app-accelerator.wit",
  "host/tests/ios-app-capability/WIT/app-database.wit",
  "host/tests/ios-app-capability/WIT/app-crypto.wit",
  "host/tests/ios-app-capability/WIT/app-audio.wit",
  "host/tests/ios-app-capability/WIT/app-web.wit",
  "host/tests/ios-app-capability/WIT/app-device-observation.wit",
  "libsrc/wasmc-app-authorization-policy/lib.wit",
  "libsrc/wasmc-system-ios-app-contacts/lib.wit",
  "libsrc/wasmc-system-android-ui/lib.wit",
  "libsrc/wasmc-system-ios-simulator-display/lib.wit",
];
for (const wit of witFiles) {
  execFileSync("wasm-tools", ["component", "wit", wit], { stdio: "ignore" });
}
assert.deepEqual(
  fs.readFileSync("host/tests/ios-app-capability/WIT/app-authorization.wit"),
  fs.readFileSync("libsrc/wasmc-app-authorization-policy/lib.wit"),
  "embedded iOS authorization WIT must match the public policy candidate",
);
assert.deepEqual(
  fs.readFileSync("host/tests/ios-app-capability/WIT/app-contacts.wit"),
  fs.readFileSync("libsrc/wasmc-system-ios-app-contacts/lib.wit"),
  "embedded iOS Contacts WIT must match the public Contacts candidate",
);
const contactsProvider = fs.readFileSync(
  "libsrc/wasmc-system-ios-app-contacts/ContactsProvider.swift", "utf8",
);
assert.match(contactsProvider, /CNContactStore\.authorizationStatus/);
assert.match(contactsProvider, /create\.add/);
assert.match(contactsProvider, /unifiedContact\(withIdentifier:/);
assert.match(contactsProvider, /remove\.delete/);
assert.match(fs.readFileSync("host/tests/ios-app-capability/project.yml", "utf8"),
  /INFOPLIST_KEY_NSContactsUsageDescription/);
const authorizationUITest = fs.readFileSync(
  "host/tests/ios-app-capability/UITests/AuthorizationFlowUITests.swift", "utf8",
);
assert.match(authorizationUITest, /Continue.*继续/);
assert.match(authorizationUITest, /Share All.*共享所有/);
assert.match(authorizationUITest, /Don.t Allow.*不允许/);
assert.match(fs.readFileSync("scripts/test-ios-app-authorization-flow.mjs", "utf8"),
  /ios-app-authorization-flow-qualification\/v1/);
execFileSync(process.execPath, ["--check", "scripts/test-ios-app-authorization-flow.mjs"],
  { stdio: "ignore" });

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-app-capability-static-validation/v1",
  fixed_host_domain_apis: 0,
  provider_count: expected.size,
  wit_packages_parsed: witFiles.length,
  target: { os: "ios", architecture: "aarch64", environment: "simulator", embedding: "native" },
  admitted: false,
  released: false,
}));
