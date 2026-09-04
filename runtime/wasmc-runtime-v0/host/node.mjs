import { dirname, isAbsolute, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export function createHost(runtimeUrl) {
  const root = dirname(fileURLToPath(runtimeUrl));
  return {
    name: 'node',
    resolve(spec) {
      if (spec instanceof URL) return fileURLToPath(spec);
      if (typeof spec === 'string' && spec.startsWith('file:')) return fileURLToPath(spec);
      return isAbsolute(String(spec)) ? String(spec) : resolvePath(root, String(spec));
    },
    readFile(path) { return readFile(path); },
    async writeFile(path, bytes) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    stdout(text) { console.log(text); },
    stderr(text) { console.error(text); }
  };
}
