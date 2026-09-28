import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS WKWebView Agent qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-app-surface-control.mjs"]);
const projectDir = "target/ios-webview-agent-project";
const derivedDir = "target/ios-webview-agent-derived";
const bundle = "io.wasmc.webview-agent-lab";
const exampleRoot = "libsrc/wasmc-system-ios-app-surface-control/examples/ios-webview-agent";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
  "--project-root", exampleRoot], { env: { ...process.env,
    WASMC_IOS_WEBVIEW_AGENT_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSWebViewAgent.xcodeproj`,
  "-scheme", "WAsmCIOSWebViewAgent", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
  "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSWebViewAgentUITests/WebViewAgentUITests/testAgentDOMActionOverlapsUserInputOnAnotherWebView"],
  { stdio: "inherit", timeout: 120_000 });
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-webview-agent.json"), "utf8"));
const nodeIDs = (snapshot) => snapshot.nodes.map((node) => node.id).sort();
const nodeText = (snapshot, id) => snapshot.nodes.find((node) => node.id === id)?.text;
assert.equal(report.schema, "wasmc.ios-webview-agent-qualification/v1");
assert.equal(report.accepted, true);
assert.equal(report.fixed_host_domain_apis, 0);
assert.equal(report.surface_count, 2);
assert.equal(report.real_wkwebview_surfaces, true);
assert.equal(report.semantic_dom_snapshot, true);
assert.equal(report.stable_element_ids, true);
assert.equal(report.agent_uses_physical_input, false);
assert.equal(report.agent_action_surface, "web-agent");
assert.equal(report.agent_action_element, "increment");
assert.equal(report.agent_surface_count, "1");
assert.equal(report.user_surface_count, "0");
assert.equal(report.user_text, "human-owned");
assert.equal(report.user_input_overlapped_agent_action, true);
assert.deepEqual(nodeIDs(report.final_agent), ["count", "increment", "note"]);
assert.deepEqual(nodeIDs(report.final_user), ["count", "increment", "note"]);
assert.equal(nodeText(report.before_agent, "count"), "0");
assert.equal(nodeText(report.final_agent, "count"), "1");
assert.equal(nodeText(report.final_user, "count"), "0");
assert.equal(report.final_agent.generation, 1);
assert.equal(report.final_user.generation, 0);
assert.equal(report.action_receipt.physical_input_injection, false);
assert.equal(report.provider_evidence[0].identity,
  "wasmc:system-ios-app-surface-control@0.0.3-dev.1");
console.log(JSON.stringify({ ...report, simulator_udid: udid }));
