import { verify } from './native-package.mjs';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {createHash} from 'node:crypto';
const [input, target, source] = process.argv.slice(2);
const root = await mkdtemp(join(tmpdir(), 'wasmc-package-negatives-'));
let rejected = 0;
try {
  const mutations = [
    m => { m.source = '0'.repeat(40); },
    m => { m.target = 'wrong'; },
    m => { m.profile = 'dual'; },
    m => { m.compiler_sha256 = '0'.repeat(64); },
    m => { m.stable = true; },
    m => { delete m.files['Cargo.lock']; },
    m => { m.files['Cargo.lock'].sha256 = '0'.repeat(64); },
    m => { delete m.files['LICENSE']; },
    m => { delete m.files['licenses/DEPENDENCY-NOTICES-001.txt']; },
  ];
  for (let i = 0; i < mutations.length + 3; i++) {
    const directory = join(root, String(i));
    await cp(input, directory, { recursive: true });
    const manifestPath = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (i < mutations.length) {
      mutations[i](manifest);
      await writeFile(manifestPath, JSON.stringify(manifest));
    } else if (i === mutations.length) await writeFile(join(directory, 'extra'), 'unexpected');
    else if(i===mutations.length+1)await writeFile(join(directory, 'Cargo.lock'), 'tampered');
    else {
      const name='licenses/DEPENDENCY-NOTICES-001.txt';
      const changed=Buffer.from(await readFile(join(directory,name)));changed[0]^=1;
      await writeFile(join(directory,name),changed);
      manifest.files[name]={bytes:changed.length,sha256:createHash('sha256').update(changed).digest('hex')};
      await writeFile(manifestPath,JSON.stringify(manifest));
    }
    let failed = false;
    try { await verify(directory, source, target); } catch { failed = true; }
    if (!failed) throw new Error(`mutation accepted: ${i}`);
    rejected++;
  }
  console.log(JSON.stringify({ accepted: true, rejected }));
} finally { await rm(root, { recursive: true, force: true }); }
