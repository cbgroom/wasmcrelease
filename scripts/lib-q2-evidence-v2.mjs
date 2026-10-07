import assert from 'node:assert/strict';

// Independent acceptance check: an executable's own accepted flag is not proof.
export function checkQ2Evidence(report, cases, pins, rounds) {
  assert.equal(report.schema, 'wasmc.generated-root-ordinary-caller-q2/v2');
  assert.equal(report.accepted, true);
  assert.ok(Number.isSafeInteger(rounds) && rounds >= 1 && rounds <= 128);
  assert.ok(Array.isArray(cases) && cases.length >= 1 && cases.length <= 128);
  assert.equal(report.rounds, rounds);
  assert.equal(report.calls_per_engine, cases.length * rounds);
  assert.equal(report.all_cases_dual_engine, true);
  assert.equal(report.shared_logical_decoder, true);
  for (const name of ['wrong_root_pin_rejected', 'wrong_bundle_pin_rejected',
    'unknown_export_rejected', 'ordinary_wasmc_source', 'fuel_diagnostic_only']) {
    assert.equal(report[name], true, name);
  }
  assert.equal(report.public_admission, false);
  assert.equal(report.root_manifest_sha256, pins.root);
  assert.equal(report.source_sha256, pins.source);
  assert.equal(report.wasmi_version, pins.wasmi);
  assert.equal(report.wasmtime_version, pins.wasmtime);
  assert.equal(report.cases.length, cases.length);
  for (let i = 0; i < cases.length; i += 1) {
    const expected = cases[i], actual = report.cases[i];
    assert.deepEqual(Object.keys(expected).sort(), ['arguments', 'expected', 'export']);
    assert.ok(Array.isArray(expected.arguments));
    assert.equal(actual.export, expected.export, 'case order/identity');
    assert.deepEqual(actual.wasmi, expected.expected, 'Wasmi independent oracle');
    assert.equal(actual.wasmtime.tested, true, 'Wasmtime cannot be skipped');
    assert.deepEqual(actual.wasmtime.value, expected.expected, 'Wasmtime independent oracle');
  }
  return true;
}
