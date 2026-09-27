import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS authorization flow requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
const projectDir = "target/ios-app-capability-project";
run("xcodegen", [
  "generate", "--spec", "host/tests/ios-app-capability/project.yml",
  "--project", projectDir, "--project-root", "host/tests/ios-app-capability",
]);

function resetInstalledIdentity(bundle) {
  try { simctl(["privacy", udid, "reset", "all", bundle], { stdio: "ignore" }); } catch {}
  try { simctl(["terminate", udid, bundle], { stdio: "ignore" }); } catch {}
  try { simctl(["uninstall", udid, bundle], { stdio: "ignore" }); } catch {}
}

function runScenario({ name, bundle, test, expectedState, expectedPlan, expectedUse }) {
  resetInstalledIdentity(bundle);
  const derived = `target/ios-authorization-${name}-derived`;
  run("xcodebuild", [
    "-quiet", "-project", `${projectDir}/WAsmCIOSAppCapability.xcodeproj`,
    "-scheme", "WAsmCIOSAppCapability", "-sdk", "iphonesimulator",
    "-destination", `id=${udid}`, "-derivedDataPath", derived,
    `WASMC_APP_BUNDLE_IDENTIFIER=${bundle}`, "-enableCodeCoverage", "NO",
    "-collect-test-diagnostics", "never", "test",
    `-only-testing:WAsmCIOSAppCapabilityUITests/AuthorizationFlowUITests/${test}`,
  ], { stdio: "inherit", timeout: 120_000 });

  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const reportPath = path.join(container, "Documents", "wasmc-ios-app-capability.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.accepted, true);
  assert.equal(report.provider_count, 3);
  const results = Object.fromEntries(report.providers.map((provider) => [provider.identity, provider.result]));
  const authorization = results["wasmc:system-ios-app-authorization@0.0.1-dev.2"];
  const decision = authorization.authorization_decisions.find((row) => row.capability === "contacts");
  const contacts = results["wasmc:system-ios-app-contacts@0.0.1-dev.1"];
  assert.equal(decision.attempt_count, 1);
  assert.equal(decision.state, expectedState);
  assert.equal(decision.plan, expectedPlan);
  assert.equal(contacts.authorization, expectedState);
  assert.equal(contacts.use_attempted, expectedUse);
  assert.equal(contacts.create_fetch_delete_roundtrip, expectedUse);
  assert.equal(contacts.cleanup_confirmed, true);
  return { bundle, decision, contacts };
}

const allowed = runScenario({
  name: "allow",
  bundle: "io.wasmc.app-capability-lab.prompt-allow",
  test: "testAllowContactsThenUseCapability",
  expectedState: "authorized",
  expectedPlan: "no-request",
  expectedUse: true,
});
const denied = runScenario({
  name: "deny",
  bundle: "io.wasmc.app-capability-lab.prompt-deny",
  test: "testDenyContactsThenFailClosed",
  expectedState: "denied",
  expectedPlan: "open-settings",
  expectedUse: false,
});

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-app-authorization-flow-qualification/v1",
  simulator_udid: udid,
  system_prompt_driven_by_xcuitest: true,
  localized_buttons: ["继续", "共享所有N位联系人", "不允许"],
  allowed,
  denied,
  fixed_host_domain_apis: 0,
  physical_device: false,
  admitted: false,
  released: false,
}));
