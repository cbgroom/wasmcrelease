import assert from 'node:assert/strict';
export const readyEpoch='initialized-runtime-before-client-connect/v1';
export const legacyEpoch='legacy-startup-overlap/v1';
export function timingEpoch(report){
  if(!report.qualification_harness)return legacyEpoch;
  assert.equal(report.qualification_harness.timed_interval,'after-runtime-readiness');
  assert.equal(report.qualification_harness.readiness,'initialized-runtime-before-client-connect');
  assert.equal(report.qualification_harness.failed_request_retry,false);
  return readyEpoch;
}
export function compatibleHistory(current,previous){
  return (current.timing_epoch??legacyEpoch)===(previous.timing_epoch??legacyEpoch);
}
