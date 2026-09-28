import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageRoot = join(root, "admission/mcpgit-resident-memory-v1/package");
const qualification = JSON.parse(
  readFileSync(
    join(root, "admission/mcpgit-resident-memory-v1/local-qualification.json"),
    "utf8",
  ),
);
const manifest = JSON.parse(readFileSync(join(packageRoot, "lib.json"), "utf8"));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [relative(packageRoot, path)];
  });
}

const exactInventory = [
  "SKILL.md",
  "artifact.wasm",
  "bindings/rust/Cargo.toml",
  "bindings/rust/src/lib.rs",
  "component.wasm",
  "core-abi.json",
  "lib.json",
  "lib.wit",
  "references/agent-delta.json",
];
assert.deepEqual(walk(packageRoot).sort(), exactInventory);
assert.equal(manifest.schema, "wasmc.lib/v2");
assert.equal(manifest.id, "mcpgit-resident-memory");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.wit.package, "mcpgit:resident-memory@0.1.0");
assert.equal(manifest.wit.world, "resident-memory");
assert.deepEqual(manifest.closure.public_lib_dependencies, []);

for (const [name, expected] of Object.entries(qualification.artifacts)) {
  const bytes = readFileSync(join(packageRoot, name));
  assert.equal(bytes.length, expected.bytes, `${name} byte length`);
  assert.equal(sha256(bytes), expected.sha256, `${name} digest`);
}

const coreBytes = readFileSync(join(packageRoot, "artifact.wasm"));
assert.deepEqual([...coreBytes.subarray(0, 4)], [0, 97, 115, 109]);
const coreImports = WebAssembly.Module.imports(new WebAssembly.Module(coreBytes));
assert.deepEqual(coreImports, [
  {
    module: "[export]mcpgit:resident-memory/memory@0.1.0",
    name: "[resource-drop]store",
    kind: "function",
  },
  {
    module: "[export]mcpgit:resident-memory/memory@0.1.0",
    name: "[resource-drop]snapshot",
    kind: "function",
  },
  {
    module: "[export]mcpgit:resident-memory/memory@0.1.0",
    name: "[resource-new]store",
    kind: "function",
  },
  {
    module: "[export]mcpgit:resident-memory/memory@0.1.0",
    name: "[resource-new]snapshot",
    kind: "function",
  },
]);
assert.equal(statSync(join(packageRoot, "component.wasm")).size, manifest.component.bytes);

const generatedBinding = readFileSync(
  join(packageRoot, "bindings/rust/src/lib.rs"),
  "utf8",
);
assert.match(generatedBinding, /^\/\/ Generated from digest-bound WIT\/Component metadata\./);
assert.match(generatedBinding, /wasmtime::component::bindgen!/);
assert.doesNotMatch(generatedBinding, /mcpgit_resident_kernel|ResidentKernel|git2|reqwest/);
assert.equal(exactInventory.some((path) => path === "Cargo.lock" || path.includes("target/")), false);
assert.deepEqual(qualification.states, {
  qualified: true,
  admitted: false,
  released: false,
  discoverable: false,
  installable: false,
});

console.log(
  JSON.stringify({
    accepted: true,
    schema: qualification.schema,
    package: `${manifest.id}@${manifest.version}`,
    files: exactInventory.length,
    bytes: qualification.package.bytes,
    provider_source: false,
    canonical_resource_intrinsics: coreImports.length,
    host_authorities: 0,
    states: qualification.states,
  }),
);
