import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = "examples/system-agent-lab/platform/ios/composition.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const readJSON = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});

function mergeComposition(value, validateBindings = true) {
  assert.equal(value.schema, "wasmc.system-agent-lab-composition/v1");
  assert.equal(value.host.contract, "wasmc.lib-defined-host-boundary/v1");
  assert.equal(value.host.required_domain_apis, 0);
  assert.ok(Array.isArray(value.scenarios) && value.scenarios.length > 1);
  for (const field of ["id", "provider", "api"]) {
    const values = value.scenarios.map((scenario) => scenario[field]);
    assert.equal(new Set(values).size, values.length, `duplicate scenario ${field}`);
  }
  const frameworks = new Set();
  const backgroundModes = new Set();
  const exclusiveOwners = new Map();
  const plist = {};
  for (const scenario of value.scenarios) {
    for (const framework of scenario.frameworks) frameworks.add(framework);
    for (const mode of scenario.app_requirements.background_modes) backgroundModes.add(mode);
    for (const resource of scenario.app_requirements.exclusive_resources) {
      assert.ok(!exclusiveOwners.has(resource),
        `exclusive resource ${resource} already owned by ${exclusiveOwners.get(resource)}`);
      exclusiveOwners.set(resource, scenario.id);
    }
    for (const [key, setting] of Object.entries(scenario.app_requirements.plist)) {
      if (Object.hasOwn(plist, key)) assert.deepEqual(plist[key], setting, `plist conflict: ${key}`);
      plist[key] = setting;
    }
    if (!validateBindings) continue;
    const candidate = readJSON(scenario.candidate);
    assert.equal(candidate.schema, "wasmc.libsrc-candidate/v1");
    assert.equal(candidate.system_binding.implements, scenario.api);
    assert.equal(candidate.system_binding.boundary, value.host.contract);
    assert.equal(candidate.system_binding.lifecycle.qualified, true);
    assert.equal(candidate.system_binding.lifecycle.admitted, false);
    assert.ok(candidate.system_binding.targets.some((target) =>
      JSON.stringify(target) === JSON.stringify(value.target)));
    const packageRoot = path.dirname(scenario.candidate);
    const binding = readJSON(path.join(packageRoot, candidate.system_binding.descriptor));
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
  }
  return {
    frameworks: [...frameworks].sort(),
    background_modes: [...backgroundModes].sort(),
    plist,
    exclusive_resources: [...exclusiveOwners.keys()].sort(),
  };
}

assert.deepEqual(mergeComposition(manifest), manifest.expected_merge);
const duplicate = structuredClone(manifest);
duplicate.scenarios[1].provider = duplicate.scenarios[0].provider;
assert.throws(() => mergeComposition(duplicate, false), /duplicate scenario provider/);
const plistConflict = structuredClone(manifest);
plistConflict.scenarios[0].app_requirements.plist.SharedKey = "a";
plistConflict.scenarios[1].app_requirements.plist.SharedKey = "b";
assert.throws(() => mergeComposition(plistConflict, false), /plist conflict/);
const resourceConflict = structuredClone(manifest);
resourceConflict.scenarios[0].app_requirements.exclusive_resources = ["camera-session"];
resourceConflict.scenarios[1].app_requirements.exclusive_resources = ["camera-session"];
assert.throws(() => mergeComposition(resourceConflict, false), /exclusive resource/);

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
