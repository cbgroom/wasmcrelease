import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertCompositionNegativeControls,
  validateAndMergeComposition,
} from "./system-agent-lab-composition.mjs";

const root = process.cwd();
const manifestPath = "examples/system-agent-lab/platform/ios/composition.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});

const mergeComposition = (value, validateBindings = true) => validateAndMergeComposition(
  root,
  value,
  {
    validateBindings,
    validateBinding: ({ scenario, binding, packageRoot }) => {
    assert.equal(binding.identity, scenario.provider);
    assert.deepEqual(binding.target, value.target);
    const descriptorSources = binding.artifact.sources.map((source) => path.join(packageRoot, source));
    for (const source of scenario.sources) {
      assert.ok(descriptorSources.includes(source), `${scenario.id}: undeclared provider source ${source}`);
      assert.ok(fs.statSync(source).size > 0);
    }
    for (const framework of scenario.frameworks) {
      assert.ok(binding.artifact.frameworks.includes(framework),
        `${scenario.id}: undeclared framework ${framework}`);
    }
    },
  },
);

assert.deepEqual(mergeComposition(manifest), manifest.expected_merge);
assertCompositionNegativeControls(root, manifest);

const fixedHost = fs.readFileSync(manifest.host.source);
const fixedHostSHA256 = createHash("sha256").update(fixedHost).digest("hex");
assert.equal(fixedHostSHA256, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");
const projectSpec = fs.readFileSync("examples/system-agent-lab/platform/ios/project.yml", "utf8");
for (const source of manifest.scenarios.flatMap((scenario) => scenario.sources)) {
  const relativeFromProject = path.relative("examples/system-agent-lab/platform/ios", source);
  assert.match(projectSpec, new RegExp(relativeFromProject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
const genericIOSSimulatorBuild = process.platform === "darwin";
if (genericIOSSimulatorBuild) {
  const projectDir = "target/system-agent-lab-ios-project";
  const derivedDir = "target/system-agent-lab-ios-derived";
  fs.mkdirSync(projectDir, { recursive: true });
  run("xcodegen", ["generate", "--spec", "examples/system-agent-lab/platform/ios/project.yml",
    "--project", projectDir, "--project-root", "examples/system-agent-lab/platform/ios"], {
    env: { ...process.env, WASMC_SYSTEM_AGENT_LAB_INFO_PLIST: path.join(
      root, "examples/system-agent-lab/platform/ios/App/Info.plist",
    ) },
  });
  run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCSystemAgentLab.xcodeproj`,
    "-scheme", "WAsmCSystemAgentLab", "-sdk", "iphonesimulator",
    "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", derivedDir,
    "CODE_SIGNING_ALLOWED=NO", "build"], { stdio: "inherit", timeout: 120_000 });
}

console.log(JSON.stringify({
  accepted: true,
  schema: manifest.schema,
  composition: manifest.id,
  scenarios: manifest.scenarios.length,
  providers: manifest.scenarios.map((scenario) => scenario.provider).sort(),
  merged: manifest.expected_merge,
  duplicate_provider_rejected: true,
  plist_conflict_rejected: true,
  exclusive_resource_conflict_rejected: true,
  fixed_host_domain_apis: 0,
  fixed_host_sha256: fixedHostSHA256,
  generic_ios_simulator_build: genericIOSSimulatorBuild,
  qualified: manifest.lifecycle.qualified,
  admitted: false,
  released: false,
}));
