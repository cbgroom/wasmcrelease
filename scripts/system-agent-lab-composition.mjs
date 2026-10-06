import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const readJSON = (root, relative) => JSON.parse(
  fs.readFileSync(path.join(root, relative), "utf8"),
);

export function validateAndMergeComposition(root, value, options = {}) {
  const validateBindings = options.validateBindings ?? true;
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
    for (const framework of scenario.frameworks ?? []) frameworks.add(framework);
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

    const candidate = readJSON(root, scenario.candidate);
    assert.equal(candidate.schema, "wasmc.lib-refresh-source/v2");
    assert.equal(candidate.native.binding.implements, scenario.api);
    assert.equal(candidate.native.binding.boundary, value.host.contract);
    assert.equal(candidate.profile, "native");
    assert.ok(Array.isArray(candidate.native.files));
    assert.ok(candidate.native.binding.targets.some((target) =>
      JSON.stringify(target) === JSON.stringify(value.target)));
    const packageRoot = path.dirname(scenario.candidate);
    const binding = readJSON(root, path.join(packageRoot, candidate.native.binding.descriptor));
    assert.equal(binding.identity, scenario.provider);
    for (const source of scenario.sources) {
      assert.ok(fs.statSync(path.join(root, source)).size > 0);
      assert.ok(candidate.native.files.includes(path.relative(packageRoot, source)),
        `${scenario.id}: source absent from exact candidate: ${source}`);
    }
    options.validateBinding?.({ scenario, candidate, binding, packageRoot, manifest: value });
  }
  return {
    frameworks: [...frameworks].sort(),
    background_modes: [...backgroundModes].sort(),
    plist,
    exclusive_resources: [...exclusiveOwners.keys()].sort(),
  };
}

export function assertCompositionNegativeControls(root, manifest) {
  const merge = (value) => validateAndMergeComposition(root, value, { validateBindings: false });
  const duplicate = structuredClone(manifest);
  duplicate.scenarios[1].provider = duplicate.scenarios[0].provider;
  assert.throws(() => merge(duplicate), /duplicate scenario provider/);
  const plistConflict = structuredClone(manifest);
  plistConflict.scenarios[0].app_requirements.plist.SharedKey = "a";
  plistConflict.scenarios[1].app_requirements.plist.SharedKey = "b";
  assert.throws(() => merge(plistConflict), /plist conflict/);
  const resourceConflict = structuredClone(manifest);
  resourceConflict.scenarios[0].app_requirements.exclusive_resources = ["camera-session"];
  resourceConflict.scenarios[1].app_requirements.exclusive_resources = ["camera-session"];
  assert.throws(() => merge(resourceConflict), /exclusive resource/);
}

