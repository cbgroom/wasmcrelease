#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
import assert from 'node:assert/strict';
import {currentProductReader,currentProductPaths,verifyCurrentRelease} from './current-lib-release-v3.mjs';
import {checkNormalCoreSdkBudgets} from './current-normal-core-sdk-quota-check.mjs';
const args=process.argv.slice(2);let root=fileURLToPath(new URL('../',import.meta.url)),expected=null;
if(args.length){
  assert.equal(args.length,4,'use --product <absolute-path> --catalog-sha256 <sha256>');
  const options={};for(let i=0;i<args.length;i+=2){assert.ok(['--product','--catalog-sha256'].includes(args[i])&&!Object.hasOwn(options,args[i]),'invalid or duplicate option');options[args[i]]=args[i+1];}
  assert.ok(isAbsolute(options['--product']??''),'absolute product path required');assert.match(options['--catalog-sha256']??'',/^[a-f0-9]{64}$/,'independent catalog pin required');root=options['--product'];expected=options['--catalog-sha256'];
}
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes),cohort=JSON.parse(read(catalog.cohort.path));
let closure;
if(expected){
  assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1','candidate composition required');
  const assembly=JSON.parse(read('admission/current-composition-assembly-v1.json'));
  assert.equal(assembly.schema,'wasmc.current-composition-assembly/v1');assert.equal(assembly.accepted,true);assert.equal(assembly.catalog_sha256,expected);
  closure=verifyCurrentRelease(catalogBytes,expected,read,currentProductPaths(root));assert.deepEqual(closure,assembly.closure,'independently reopened assembly closure');
}else if(cohort.schema==='wasmc.public-current-composition-cohort/v1'||catalog.cohort.path==='admission/current-composition-cohort-v1.json'){
  assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1');
  const admission=JSON.parse(read('admission/current-product-v3.json'));
  assert.equal(admission.schema,'wasmc.current-composition-release-closure/v1');
  closure=verifyCurrentRelease(catalogBytes,admission.catalog_sha256,read,currentProductPaths(root));
  assert.deepEqual(closure,admission,'independently retained composition closure');
}else closure=verifyCurrentRelease(catalogBytes,'81db5d610d53c7627fd91a4bbd47a22610bd1982718b845dc1557b81657f0e74',read,currentProductPaths(root));
if(Number(catalog.version.split('.')[2])>=31)checkNormalCoreSdkBudgets(catalog,read);
console.log(JSON.stringify({accepted:true,...closure,scope:expected?'independently pinned candidate assembly; not formal release':'current complete Roots, public WIT routes, source/notice pins and actual compiled Core Search; source-only Native remains unexecuted'}));
