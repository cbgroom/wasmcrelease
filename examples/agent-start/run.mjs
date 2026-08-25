import { readFile } from "node:fs/promises";
import { compile, inspectWasm } from "../../dist/wasmc.mjs";

const cases = [
  { file: "01_add.wasmc", args: [5, 6], expected: 17 },
  { file: "02_control_flow.wasmc", args: [5, 10], expected: 10 },
  { file: "03_private_function.wasmc", args: [-9], expected: 10 },
  { file: "04_record.wasmc", args: [4, 5], expected: 9 },
  {
    file: "05_host_import.wasmc",
    args: [7],
    imports: { host: { double: (value) => value * 2 } },
    expected: 15,
    expectedImports: ["host.double"],
  },
];

for (const test of cases) {
  const source = await readFile(new URL(test.file, import.meta.url), "utf8");
  const wasm = await compile(source);
  const inspected = inspectWasm(wasm);
  const imports = inspected.imports.map((entry) => `${entry.module}.${entry.name}`);
  if (JSON.stringify(imports) !== JSON.stringify(test.expectedImports ?? [])) {
    throw new Error(`${test.file}: unexpected imports ${JSON.stringify(imports)}`);
  }
  const instance = await WebAssembly.instantiate(inspected.module, test.imports ?? {});
  const actual = instance.exports.run(...test.args);
  if (actual !== test.expected) {
    throw new Error(`${test.file}: expected ${test.expected}, got ${actual}`);
  }
  console.log(`PASS ${test.file}: run=${actual}, wasm=${wasm.length} bytes, imports=${imports.length}`);
}
