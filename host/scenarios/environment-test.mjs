import {probeEnvironment} from './environment-probe.mjs';
const receipt = await probeEnvironment();
let negativeControls=0;
const original = {crypto:globalThis.crypto, performance:globalThis.performance,wallNow:()=>Date.now()};
for(const missing of ['crypto','performance','wallNow']) {
  try { await probeEnvironment({...original,[missing]:undefined}); throw Error('missing rejection'); }
  catch(e) { if(e.message!=='platform.source_unsupported') throw e; negativeControls++; }
}
for(const performance of [{now:()=>NaN},{now:()=>-1}]) {
  try { await probeEnvironment({...original,performance}); throw Error('missing rejection'); }
  catch(e) { if(e.message!=='platform.clock_invalid') throw e; negativeControls++; }
}
console.log(JSON.stringify({...receipt,negative_controls:negativeControls}));
