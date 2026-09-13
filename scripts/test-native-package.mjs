import { verify } from './native-package.mjs';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  ];
  for (let i = 0; i < mutations.length + 2; i++) {
    const directory = join(root, String(i));
    await cp(input, directory, { recursive: true });
    const manifestPath = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (i < mutations.length) {
      mutations[i](manifest);
      await writeFile(manifestPath, JSON.stringify(manifest));
    } else if (i === mutations.length) await writeFile(join(directory, 'extra'), 'unexpected');
    else await writeFile(join(directory, 'Cargo.lock'), 'tampered');
    let failed = false;
    try { await verify(directory, source, target); } catch { failed = true; }
    if (!failed) throw new Error(`mutation accepted: ${i}`);
    rejected++;
  }
  console.log(JSON.stringify({ accepted: true, rejected }));
} finally { await rm(root, { recursive: true, force: true }); }
