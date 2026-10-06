import { generatedLib } from './generated-lib-v2.mjs';
const selected=await generatedLib('wasmc-tls-client');
console.log(JSON.stringify({accepted:true,schema:'wasmc.generated-lib-selection/v2',
  artifact:selected.artifact,component:selected.component,manifest_sha256:selected.row.manifest_sha256,
  artifact_sha256:selected.row.artifact_sha256,source:'verified-refresh-receipt',built:false}));
