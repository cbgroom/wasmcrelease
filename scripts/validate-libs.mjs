#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root);
const closure=verifyCurrentRelease(read('catalog/libs-current-v2.json'),'81db5d610d53c7627fd91a4bbd47a22610bd1982718b845dc1557b81657f0e74',read,currentProductPaths(root));
console.log(JSON.stringify({accepted:true,...closure,scope:'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
