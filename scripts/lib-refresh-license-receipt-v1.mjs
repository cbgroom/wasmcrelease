import assert from 'node:assert/strict';
import {dirname,isAbsolute,join} from 'node:path';
import {sha,MAX_LICENSE_SNAPSHOT_BYTES} from './lib-refresh-cache-v2.mjs';

// Replay only explicit, independently pinned release inputs. External paths
// become part of the resource/upstream closure; they are never discovered.
export async function verifyReleaseLicenseReceipt(repo, receipt, load) {
  const license=receipt.release_license_input, notices=receipt.release_notices_input, external={};
  assert.ok(!notices || license, 'release notices require a release license');
  if (!license) return external;
  const read = async (path, pin) => {
    assert.ok(isAbsolute(path));assert.match(pin,/^[a-f0-9]{64}$/);
    const recorded=path.startsWith(repo+'/') ? receipt.source_digests?.[path.slice(repo.length+1)] : receipt.producer_input_digests?.[path];
    assert.equal(recorded,pin,'release input receipt identity');
    const data=await load(path);assert.equal(sha(data),pin,'release input drift: '+path);
    if (!path.startsWith(repo+'/')) external[path]=pin;
    return data;
  };
  assert.deepEqual(Object.keys(license).sort(),['path','sha256']);
  const root=await read(license.path,license.sha256);
  assert.ok(root.length>0 && root.length<=MAX_LICENSE_SNAPSHOT_BYTES);
  if (!notices) return external;
  assert.deepEqual(Object.keys(notices).sort(),['path','sha256']);
  const manifest=JSON.parse(await read(notices.path,notices.sha256));
  assert.equal(manifest.schema,'wasmc.release-notices-input/v1');
  assert.ok(Array.isArray(manifest.files)&&manifest.files.length>0&&manifest.files.length<=31);
  let previous='',total=root.length;
  for(const entry of manifest.files){
    assert.deepEqual(Object.keys(entry).sort(),['bytes','path','sha256']);
    assert.match(entry.path,/^licenses\/[A-Za-z0-9_.-]{1,128}$/);
    assert.ok(entry.path>previous&&!['licenses/.','licenses/..'].includes(entry.path));previous=entry.path;
    assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=MAX_LICENSE_SNAPSHOT_BYTES);
    const bytes=await read(join(dirname(notices.path),entry.path.slice('licenses/'.length)),entry.sha256);
    assert.equal(bytes.length,entry.bytes);new TextDecoder('utf-8',{fatal:true}).decode(bytes);total+=bytes.length;
  }
  assert.ok(total<=MAX_LICENSE_SNAPSHOT_BYTES,'release input snapshot budget');
  return external;
}
