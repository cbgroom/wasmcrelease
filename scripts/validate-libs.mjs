#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
import {checkNormalCoreSdkBudgets} from './current-normal-core-sdk-quota-check.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root);
const catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes),cohort=JSON.parse(read(catalog.cohort.path));
let closure;
if(cohort.schema==='wasmc.public-current-composition-cohort/v1'||catalog.cohort.path==='admission/current-composition-cohort-v1.json'){
  assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1');
  const admission=JSON.parse(read('admission/current-product-v3.json'));
  assert.equal(admission.schema,'wasmc.current-composition-release-closure/v1');
  closure=verifyCurrentRelease(catalogBytes,admission.catalog_sha256,read,currentProductPaths(root));
  assert.deepEqual(closure,admission,'independently retained composition closure');
}else closure=verifyCurrentRelease(catalogBytes,'81db5d610d53c7627fd91a4bbd47a22610bd1982718b845dc1557b81657f0e74',read,currentProductPaths(root));
if(Number(catalog.version.split('.')[2])>=31)checkNormalCoreSdkBudgets(catalog,read);
console.log(JSON.stringify({accepted:true,...closure,scope:'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
