#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root);
const closure=verifyCurrentRelease(read('catalog/libs-current-v2.json'),'a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad',read,currentProductPaths(root));
console.log(JSON.stringify({accepted:true,...closure,scope:'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
