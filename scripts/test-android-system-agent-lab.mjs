import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const run = (script) => execFileSync(process.execPath, [script], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  timeout: 300_000,
}).trim();

const composition = JSON.parse(run("scripts/validate-android-system-agent-lab.mjs"));
assert.equal(composition.accepted, true);
assert.equal(composition.scenarios, 4);
const runtime = JSON.parse(run("scripts/test-android-agent-computer.mjs"));
assert.equal(runtime.accepted, true);
assert.deepEqual(runtime.binding_identities, composition.providers);
assert.equal(runtime.host_domain_apis, 0);
assert.equal(runtime.profile.exact_regeneration, true);
assert.equal(runtime.semantic_ui_query, true);
assert.equal(runtime.direct_uinput.persistent_session, true);
assert.equal(runtime.direct_uinput.direct_touchscreen, true);
console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.android-system-agent-lab-qualification/v1",
  composition: composition.composition,
  providers: composition.providers,
  fixed_host_sha256: runtime.fixed_android_host_sha256,
  host_domain_apis: runtime.host_domain_apis,
  real_frame: runtime.real_frame,
  semantic_ui_query: runtime.semantic_ui_query,
  shell_input_postcondition: runtime.exact_text_postcondition,
  direct_uinput: runtime.direct_uinput,
  physical_device: false,
  qualified: true,
  admitted: false,
  released: false,
  discoverable: false,
  installable: false,
}));

