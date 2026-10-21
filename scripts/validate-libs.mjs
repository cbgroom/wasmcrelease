#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root);
const closure=verifyCurrentRelease(read('catalog/libs-current-v2.json'),'76f9a0ca465c7d6169738be04ac725dceac2cdde14bbfc5215c37c2e97c86f43',read,currentProductPaths(root));
console.log(JSON.stringify({accepted:true,...closure,scope:'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
