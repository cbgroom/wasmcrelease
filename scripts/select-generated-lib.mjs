import assert from 'node:assert/strict';
import {generatedLib,selectedRun} from './generated-lib-v2.mjs';
const id=process.argv[2];assert.ok(id&&!id.startsWith('-'),'required: <library-id> --run-root <successful refresh>');
const value=await generatedLib(id,selectedRun(process.argv.slice(3)));
console.log(JSON.stringify({accepted:true,id,root:value.root,artifact:value.artifact,component:value.component,
  manifest_sha256:value.row.manifest_sha256,artifact_sha256:value.row.artifact_sha256,
  component_sha256:value.row.component_sha256}));
