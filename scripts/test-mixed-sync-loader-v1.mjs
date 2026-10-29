import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
assert.equal(typeof require('./mixed-current-product-v1.mjs').verifyMixedFromCatalog,'function');
console.log(JSON.stringify({accepted:true,scope:'synchronous mixed verifier module loader only'}));
