import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import * as facade from "../dist/wasmc.mjs";

const execFileAsync = promisify(execFile);

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url)));
const index = JSON.parse(await readFile(new URL("../package-index.json", import.meta.url)));
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const libGuide = await readFile(new URL("../LIB.md", import.meta.url), "utf8");

if (manifest.version !== release.version || release.version !== index.latest || release.tag !== `v${index.latest}`) {
  throw new Error("manifest, release, and latest metadata identities differ");
}
for (const name of ["compile", "compileLib", "instantiateLib", "inspectWasm"]) {
  if (typeof facade[name] !== "function") throw new Error(`missing public facade function: ${name}`);
}
if (!agents.includes("skills/wasmc-developer/SKILL.md") || !libGuide.includes("WIT owns public identity")) {
  throw new Error("Agent-first Skill or WIT/Lib authority is missing");
}

const scalar = `package local:add;
interface api { run: func(a: s32, b: s32) -> s32 { return a + b * 2; } }
world app { export api; }`;
const bytes = await facade.compile(scalar);
const inspected = facade.inspectWasm(bytes);
if (inspected.imports.length !== 0) throw new Error("scalar probe unexpectedly imports Host authority");
const scalarInstance = await WebAssembly.instantiate(inspected.module, {});
if (scalarInstance.exports.run(5, 6) !== 17) throw new Error("scalar behavior drifted");

const managed = `package local:orders;
interface api {
  record Item { sku: string, price: s32 }
  count: func() -> u32 {
    let mut items: list<Item> = list.new();
    items.push({ sku: "book", price: 5 });
    let mut totals: map<string,s32> = map.new();
    totals.insert("book", 12);
    return items.len() + totals.len();
  }
}
world app { export api; }`;
const managedInstance = await facade.instantiateLib(managed);
if (managedInstance.exports.count() !== 2) throw new Error("managed Lib behavior drifted");

const runtimeRoot = new URL("../runtime/wasmc-runtime-v0/", import.meta.url);
const selfTest = await execFileAsync(process.execPath, [new URL("bootstrap.mjs", runtimeRoot).pathname, "self-test"]);
const selfTestJson = JSON.parse(selfTest.stdout);
if (!selfTestJson.accepted || selfTestJson.runtime !== "node" || selfTestJson.compiler_bytes !== 1484773) {
  throw new Error("runtime Node self-test drifted");
}
const temporary = await mkdtemp(join(tmpdir(), "wasmc-agent-docs-"));
try {
  const output = join(temporary, "add.wasm");
  await execFileAsync(process.execPath, [
    new URL("bootstrap.mjs", runtimeRoot).pathname,
    "compile",
    "--input",
    new URL("examples/add.wasmc", runtimeRoot).pathname,
    "--output",
    output,
  ]);
  await WebAssembly.compile(await readFile(output));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log("PASS public Agent legacy scalar/Lib journeys plus package-manager-free Runtime journey");
