import assert from "node:assert/strict";
import fs from "node:fs";

const model = JSON.parse(fs.readFileSync("host/drivers/camera/model.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("host/manifest.json", "utf8"));

assert.equal(model.schema, "wasmc.host-camera-model/v1");
assert.equal(model.capability, "camera");
assert.ok(manifest.capabilities.includes("camera"));
assert.equal(model.support_state_effect, "none");
assert.equal(model.resource_semantics.locality_independent, true);
assert.equal(model.resource_semantics.guest_visible_native_handle, false);
assert.equal(model.capture.operation_per_frame, 1);
assert.equal(model.capture.completion_per_frame, 1);
assert.equal(model.capture.cancel, "request-only");
assert.equal(model.capture.drop, "supervision-only");
assert.equal(model.capture.per_plane_completion, false);
assert.equal(model.planes.minimum, 1);
assert.equal(model.planes.maximum, 16);
assert.equal(model.planes.native_pointer_visible, false);

for (const fixture of model.fixtures) {
  assert.equal(fixture.claim, "structural-only");
  assert.ok(fixture.plane_lengths.length >= model.planes.minimum);
  assert.ok(fixture.plane_lengths.length <= model.planes.maximum);
  assert.ok(fixture.plane_lengths.every((length) => Number.isSafeInteger(length) && length > 0));
  assert.equal(
    fixture.plane_lengths.reduce((total, length) => total + length, 0),
    fixture.aggregate_bytes,
  );
}

for (const platform of manifest.platforms) {
  const providers = JSON.parse(
    fs.readFileSync(`host/platform/${platform}/providers.json`, "utf8"),
  );
  const camera = providers.providers.find((provider) => provider.capability === "camera");
  assert.ok(camera, `${platform} must explicitly declare camera support state`);
  assert.equal(camera.status, "unimplemented", `${platform} camera must remain unimplemented`);
}

console.log(JSON.stringify({
  accepted: true,
  capability: "camera",
  shared_semantics_only: true,
  platforms_unchanged: manifest.platforms.length,
  structural_fixtures: model.fixtures.length,
}));
