#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root);
const closure=verifyCurrentRelease(read('catalog/libs-current-v2.json'),'01fda278b3c74363643879f71cc739488a57e9d934f217ab07af3460b88923d4',read,currentProductPaths(root));
console.log(JSON.stringify({accepted:true,...closure,scope:'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
