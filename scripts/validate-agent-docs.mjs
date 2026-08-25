import { readFile } from "node:fs/promises";
import * as facade from "../dist/wasmc.mjs";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const fastapi = await readFile(new URL("../FASTAPI.md", import.meta.url), "utf8");

if (manifest.version !== "0.0.2") throw new Error("update the documentation gate for a new release");
if (typeof facade.compileFastapi !== "undefined") {
  throw new Error("facade gained compileFastapi; FASTAPI.md and acceptance must be revised");
}
if (!agents.includes("Not available in `v0.0.2`") || !fastapi.includes("answer is **no**")) {
  throw new Error("managed-source availability is not explicit in the public entrypoints");
}

const structuredSources = [
  `package local:tuple_probe;
interface api { run: func(v: s32) -> tuple<s32,bool> { return tuple(v, true); } }
world app { export api; }`,
  `package local:sum_probe;
interface api {
  optional: func(v: s32) -> option<s32> {
    if (v > 0) { return some(v); }
    return none();
  }
  outcome: func(v: s32) -> result<s32,s32> {
    if (v > 0) { return ok(v); }
    return err(-1);
  }
}
world app { export api; }`,
  `package local:named_probe;
interface api {
  enum code { ok, fail }
  make: func(flag: bool) -> variant { none, code(code) } {
    return if (flag) { variant.code(0) } else { variant.none };
  }
}
world app { export api; }`,
];

for (const source of structuredSources) {
  const wasm = await facade.compile(source);
  if (!WebAssembly.validate(wasm)) throw new Error("documented structured source produced invalid Wasm");
}

console.log("PASS public Agent capability and FastAPI availability contract");
