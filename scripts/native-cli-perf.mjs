import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [binaryArg, platformId, outputArg] = process.argv.slice(2);
if (!binaryArg || !platformId || !outputArg) {
  throw new Error('usage: node scripts/native-cli-perf.mjs WASMC PLATFORM OUTPUT.json');
}
const root = process.cwd();
const binary = resolve(binaryArg);
const manifest = JSON.parse(await readFile(join(root, 'bench/manifest.json'), 'utf8'));
const scratch = await mkdtemp(join(tmpdir(), 'wasmc-public-perf-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const percentile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
};
const stats = values => ({
  samples: values.length,
  p50_ms: Number(percentile(values, 0.50).toFixed(3)),
  p95_ms: Number(percentile(values, 0.95).toFixed(3)),
  min_ms: Number(Math.min(...values).toFixed(3)),
  max_ms: Number(Math.max(...values).toFixed(3)),
});
function invoke(args, options = {}) {
  const started = process.hrtime.bigint();
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.status !== 0) {
    throw new Error(`wasmc ${args.join(' ')} failed (${result.status}): ${result.stderr}`);
  }
  return { ms, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
async function repeat(count, fn) {
  const values = [];
  for (let i = 0; i < count; i++) values.push((await fn(i)).ms);
  return stats(values);
}

try {
  const binaryBytes = await readFile(binary);
  const cases = {};
  for (const item of manifest.cases) {
    const source = resolve(item.path);
    const sourceBytes = await readFile(source);
    if (sourceBytes.length !== item.source_bytes || hash(sourceBytes) !== item.source_sha256) {
      throw new Error(`${item.id}: public benchmark source identity drifted`);
    }

    let generatedSha = null;
    const buildWasm = await repeat(manifest.samples.build_wasm, async i => {
      const out = join(scratch, `${item.id}-wasm-${i}.wasm`);
      const result = invoke(['build', source, '-o', out]);
      const bytes = await readFile(out);
      const sha = hash(bytes);
      if (bytes.length !== item.wasm_bytes || sha !== item.wasm_sha256) {
        throw new Error(`${item.id}: generated Wasm identity drifted`);
      }
      generatedSha = sha;
      return result;
    });

    const nativeMiss = await repeat(manifest.samples.native_miss, async i => {
      const out = join(scratch, `${item.id}-miss-${i}${process.platform === 'win32' ? '.exe' : ''}`);
      const cache = join(scratch, `${item.id}-cache-miss-${i}`);
      return invoke(['build', '--target', 'native', source, '-o', out], { env: { WASMC_CACHE_DIR: cache } });
    });

    const hitCache = join(scratch, `${item.id}-cache-hit`);
    const warmOut = join(scratch, `${item.id}-hit-warm${process.platform === 'win32' ? '.exe' : ''}`);
    invoke(['build', '--target', 'native', source, '-o', warmOut], { env: { WASMC_CACHE_DIR: hitCache } });
    const nativeHit = await repeat(manifest.samples.native_hit, async i => {
      const out = join(scratch, `${item.id}-hit-${i}${process.platform === 'win32' ? '.exe' : ''}`);
      const result = invoke(['build', '--target', 'native', source, '-o', out], { env: { WASMC_CACHE_DIR: hitCache } });
      if (!result.stderr.includes(' hit)') && !result.stderr.includes(' hit')) {
        throw new Error(`${item.id}: expected native cache hit`);
      }
      return result;
    });

    const row = {
      source_bytes: item.source_bytes,
      source_sha256: item.source_sha256,
      wasm_bytes: item.wasm_bytes,
      wasm_sha256: generatedSha,
      build_wasm: buildWasm,
      native_build_miss: nativeMiss,
      native_build_hit: nativeHit,
    };

    if (item.oracle) {
      for (let i = 0; i < 3; i++) {
        const warm = invoke(['run', source, ...item.oracle.args]);
        if (warm.stdout !== item.oracle.stdout) throw new Error(`${item.id}: Wasmi run oracle mismatch`);
      }
      row.run_wasmi = await repeat(manifest.samples.run_wasmi, async () => {
        const result = invoke(['run', source, ...item.oracle.args]);
        if (result.stdout !== item.oracle.stdout) throw new Error(`${item.id}: Wasmi run oracle mismatch`);
        return result;
      });

      const native = join(scratch, `${item.id}-standalone${process.platform === 'win32' ? '.exe' : ''}`);
      invoke(['build', '--target', 'native', source, '-o', native], { env: { WASMC_CACHE_DIR: hitCache } });
      const nativeSize = (await stat(native)).size;
      const nativeSha = hash(await readFile(native));
      for (let i = 0; i < 3; i++) {
        const r = spawnSync(native, item.oracle.args, { encoding: 'utf8', timeout: 120000 });
        if (r.status !== 0 || r.stdout.trim() !== item.oracle.stdout) throw new Error(`${item.id}: native oracle mismatch`);
      }
      const nativeTimes = [];
      for (let i = 0; i < manifest.samples.native_run; i++) {
        const started = process.hrtime.bigint();
        const r = spawnSync(native, item.oracle.args, { encoding: 'utf8', timeout: 120000 });
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        if (r.status !== 0 || r.stdout.trim() !== item.oracle.stdout) throw new Error(`${item.id}: native oracle mismatch`);
        nativeTimes.push(ms);
      }
      row.native_run = stats(nativeTimes);
      row.native_executable = { bytes: nativeSize, sha256: nativeSha };
    }
    cases[item.id] = row;
  }

  const report = {
    schema: 'wasmc-native-cli-performance/v1',
    measured_at: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    platform: platformId,
    host: { os: process.platform, arch: process.arch, node: process.version },
    cli: { bytes: binaryBytes.length, sha256: hash(binaryBytes) },
    corpus_schema: manifest.schema,
    policy: manifest.measurement_policy,
    cases,
  };
  await import('node:fs/promises').then(fs => fs.writeFile(resolve(outputArg), `${JSON.stringify(report, null, 2)}\n`));
  console.log(JSON.stringify({ accepted: true, platform: platformId, cases: Object.keys(cases).length }));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
