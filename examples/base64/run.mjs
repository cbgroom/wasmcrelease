import {readFile} from 'node:fs/promises';
import {exerciseBase64} from './behavior.mjs';
const providerBytes=await readFile(new URL('../../standard/corelib/4.8.0/corelib.wasm',import.meta.url));
const libBytes=await readFile(new URL('../../standard/wasmc-std/1.4.0/artifact.wasm',import.meta.url));
console.log(JSON.stringify(exerciseBase64(providerBytes,libBytes)));
