import assert from "node:assert/strict";
import fs from "node:fs";

const model = JSON.parse(fs.readFileSync("host/drivers/accelerator/model.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("host/manifest.json", "utf8"));

assert.equal(model.schema, "wasmc.host-accelerator-model/v1");
assert.deepEqual(model.typed_capabilities, ["gpu", "npu"]);
assert.equal(model.shared_substrate, true);
assert.equal(model.support_state_effect, "none");
for (const capability of model.typed_capabilities) assert.ok(manifest.capabilities.includes(capability));
assert.equal(model.resource_semantics.guest_visible_native_handle, false);
assert.equal(model.resource_semantics.capability_identity_preserved, true);
assert.equal(model.submission.operation_per_submission, 1);
assert.equal(model.submission.completion_per_submission, 1);
assert.equal(model.submission.cancel, "request-only");
assert.equal(model.submission.drop, "supervision-only");
assert.equal(model.submission.outcome_unknown, "terminal-no-replay");
assert.equal(model.submission.explicit_drain, true);
assert.equal(model.buffers.minimum, 1);
assert.equal(model.buffers.maximum, 16);
assert.equal(model.buffers.native_pointer_visible, false);
assert.equal(model.buffers.per_buffer_completion, false);

for (const fixture of model.fixtures) {
  assert.equal(fixture.claim, "structural-only");
  assert.ok(fixture.segment_lengths.length >= model.buffers.minimum);
  assert.ok(fixture.segment_lengths.length <= model.buffers.maximum);
  assert.ok(fixture.segment_lengths.every((length) => Number.isSafeInteger(length) && length > 0));
  assert.equal(fixture.segment_lengths.reduce((total, length) => total + length, 0), fixture.aggregate_bytes);
}

for (const platform of manifest.platforms) {
  const providers = JSON.parse(fs.readFileSync(`host/platform/${platform}/providers.json`, "utf8"));
  for (const capability of model.typed_capabilities) {
    const provider = providers.providers.find((item) => item.capability === capability);
    assert.ok(provider, `${platform} must explicitly declare ${capability} support state`);
    assert.equal(provider.status, "unimplemented", `${platform}/${capability} must remain unimplemented`);
  }
}

console.log(JSON.stringify({
  accepted: true,
  typed_capabilities: model.typed_capabilities,
  shared_substrate: true,
  platforms_unchanged: manifest.platforms.length,
  structural_fixtures: model.fixtures.length,
}));
