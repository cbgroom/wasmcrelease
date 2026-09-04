export function createHost(runtimeUrl) {
  const root = new URL('.', runtimeUrl);
  return {
    name: 'deno',
    resolve(spec) {
      if (spec instanceof URL) return spec;
      if (String(spec).startsWith('file:')) return new URL(String(spec));
      try { return new URL(String(spec)); } catch (_) { return new URL(String(spec), root); }
    },
    readFile(path) { return Deno.readFile(path); },
    async writeFile(path, bytes) {
      const url = path instanceof URL ? path : new URL(String(path));
      const parts = url.pathname.split('/').slice(0, -1).join('/') || '/';
      await Deno.mkdir(new URL(parts.endsWith('/') ? parts : `${parts}/`, url), { recursive: true });
      await Deno.writeFile(url, bytes);
    },
    stdout(text) { console.log(text); },
    stderr(text) { console.error(text); }
  };
}
