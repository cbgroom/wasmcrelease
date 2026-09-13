// Real platform-source preflight. Not a v1 Host binding or security quality proof.
export async function probeEnvironment({crypto, performance, wallNow} = {
  crypto: globalThis.crypto, performance: globalThis.performance, wallNow: () => Date.now(),
}) {
  if (typeof crypto?.getRandomValues !== 'function' || typeof crypto?.subtle?.digest !== 'function'
      || typeof performance?.now !== 'function' || typeof wallNow !== 'function') {
    throw new Error('platform.source_unsupported');
  }
  const samples = [];
  for (let i=0;i<32;i++) samples.push(performance.now());
  if (samples.some((n,i) => !Number.isFinite(n) || n<0 || (i>0 && n<samples[i-1]))) {
    throw new Error('platform.clock_invalid');
  }
  const wall = wallNow();
  if (!Number.isSafeInteger(wall) || wall<=0) throw new Error('platform.clock_invalid');
  const a = new Uint8Array(32), b = new Uint8Array(32);
  crypto.getRandomValues(a); crypto.getRandomValues(b);
  if (a.every((n,i)=>n===b[i]) || a.every(n=>n===0)) throw new Error('platform.entropy_invalid');
  await crypto.subtle.digest('SHA-256', a); // Consume actual source, publish no nonce.
  return {accepted:true, scope:'platform-source-preflight-not-v1-host-api-proof',
    monotonic_samples:samples.length, wall_clock_available:true, entropy_bytes:64,
    entropy_quality_proven:false, guest_v1_execution:false};
}
