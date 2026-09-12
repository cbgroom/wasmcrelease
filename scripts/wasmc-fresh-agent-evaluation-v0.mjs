import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const out = {
    releaseRoot: null,
    runtimeRoot: null,
    guidanceRoot: null,
    managedCompiler: null,
    candidateCommit: null,
    jsonOut: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--release-root') out.releaseRoot = argv[++index];
    else if (value === '--runtime-root') out.runtimeRoot = argv[++index];
    else if (value === '--guidance-root') out.guidanceRoot = argv[++index];
    else if (value === '--managed-compiler') out.managedCompiler = argv[++index];
    else if (value === '--candidate-commit') out.candidateCommit = argv[++index];
    else if (value === '--json-out') out.jsonOut = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!out.releaseRoot) throw new Error('--release-root is required');
  return out;
}

function absolute(path) {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function scoreDimension(id, weight, points, details) {
  assert.ok(points >= 0 && points <= weight, `${id} points out of range`);
  return { id, weight, points, passed: points === weight, details };
}

function markdownSubsection(text, heading) {
  const marker = `### ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const next = text.indexOf('\n### ', start + marker.length);
  return text.slice(start, next < 0 ? text.length : next);
}

function importGuidanceDetails(text) {
  const repositoryHeading = 'Source-free repository checkout';
  const packageHeading = 'Installed package';
  const repositorySection = markdownSubsection(text, repositoryHeading);
  const packageSection = markdownSubsection(text, packageHeading);
  const repositoryImport =
    repositorySection !== null &&
    /from\s+["']\.\/current\/wasmc\.mjs["']/.test(repositorySection);
  const packageImport =
    packageSection !== null &&
    /from\s+["']@wasmc\/compiler["']/.test(packageSection);
  const repositoryContextIsolated =
    repositorySection !== null && !repositorySection.includes('@wasmc/compiler');
  const packageContextIsolated =
    packageSection !== null && !packageSection.includes('./current/wasmc.mjs');
  const ordered =
    repositorySection !== null &&
    packageSection !== null &&
    text.indexOf(`### ${repositoryHeading}`) < text.indexOf(`### ${packageHeading}`);
  return {
    repository_heading: repositorySection !== null,
    installed_package_heading: packageSection !== null,
    repository_import: repositoryImport,
    installed_package_import: packageImport,
    repository_context_isolated: repositoryContextIsolated,
    installed_package_context_isolated: packageContextIsolated,
    repository_before_package: ordered,
    clear:
      repositoryImport &&
      packageImport &&
      repositoryContextIsolated &&
      packageContextIsolated &&
      ordered
  };
}

function collectPythonFiles(root, current = root) {
  const rows = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'target' || entry.name === '__pycache__') {
      continue;
    }
    const path = join(current, entry.name);
    if (entry.isDirectory()) rows.push(...collectPythonFiles(root, path));
    else if (entry.isFile() && entry.name.endsWith('.py')) {
      rows.push(path.slice(root.length + 1));
    }
  }
  return rows.sort();
}

const options = parseArgs(process.argv.slice(2));
const releaseRoot = absolute(options.releaseRoot);
const guidanceRoot = absolute(options.guidanceRoot ?? releaseRoot);
const nestedRuntime = join(releaseRoot, 'runtime/wasmc-runtime-v0');
const runtimeRoot = absolute(
  options.runtimeRoot ?? (existsSync(nestedRuntime) ? nestedRuntime : releaseRoot)
);
const managedCompilerPath = options.managedCompiler
  ? absolute(options.managedCompiler)
  : null;
if (
  options.candidateCommit !== null &&
  !/^[0-9a-f]{40}$/.test(options.candidateCommit)
) {
  throw new Error('--candidate-commit must be an exact lowercase 40-hex commit');
}
const fullRelease = existsSync(join(releaseRoot, 'AGENTS.md'));
const temporary = mkdtempSync(join(tmpdir(), 'wasmc-fresh-agent-'));
const dimensions = [];
const findings = [];

function guidanceFile(relative) {
  const candidate = join(guidanceRoot, relative);
  if (existsSync(candidate)) {
    return {
      path: candidate,
      source: guidanceRoot === releaseRoot ? 'release-root' : 'guidance-root'
    };
  }
  const published = join(releaseRoot, relative);
  return existsSync(published)
    ? { path: published, source: 'release-root-fallback' }
    : { path: candidate, source: 'missing' };
}

try {
  let discoveryPoints = 0;
  const discovery = {};
  if (fullRelease) {
    const agentsFile = guidanceFile('AGENTS.md');
    const skillFile = guidanceFile('skills/wasmc-developer/SKILL.md');
    const runtimeFile = guidanceFile('skills/wasmc-developer/references/runtime.md');
    const libFile = guidanceFile('skills/wasmc-developer/references/lib.md');
    const agents = existsSync(agentsFile.path)
      ? readFileSync(agentsFile.path, 'utf8')
      : '';
    const skillPath = skillFile.path;
    const runtimeReference = runtimeFile.path;
    discovery.guidance_sources = {
      agents: agentsFile.source,
      developer_skill: skillFile.source,
      runtime_reference: runtimeFile.source,
      lib_reference: libFile.source
    };
    discovery.public_agent_entry = agents.includes('skills/wasmc-developer/SKILL.md');
    discovery.developer_skill = existsSync(skillPath);
    discovery.runtime_route = existsSync(runtimeReference);
    if (discovery.public_agent_entry) discoveryPoints += 4;
    if (discovery.developer_skill) discoveryPoints += 4;
    if (discovery.runtime_route) discoveryPoints += 4;
    if (existsSync(libFile.path)) {
      const libText = readFileSync(libFile.path, 'utf8');
      const importGuidance = importGuidanceDetails(libText);
      discovery.repository_package_import_guidance = importGuidance;
      discovery.repository_package_import_forms_clear = importGuidance.clear;
      if (discovery.repository_package_import_forms_clear) {
        discoveryPoints += 3;
      } else {
        findings.push({
          priority: 'P1',
          id: 'repository-package-import-ambiguity',
          summary:
            'The public Lib guidance does not isolate an exact ./current/wasmc.mjs repository-checkout import from an exact @wasmc/compiler installed-package import.'
        });
      }
    } else {
      discovery.repository_package_import_guidance = null;
      discovery.repository_package_import_forms_clear = false;
      findings.push({
        priority: 'P1',
        id: 'repository-package-import-ambiguity',
        summary: 'The public Lib guidance is missing.'
      });
    }
  } else {
    discovery.runtime_readme = existsSync(join(runtimeRoot, 'README.md'));
    discovery.runtime_manifest = existsSync(join(runtimeRoot, 'manifest.json'));
    discoveryPoints =
      (discovery.runtime_readme ? 7 : 0) + (discovery.runtime_manifest ? 8 : 0);
  }
  dimensions.push(scoreDimension('discovery', 15, discoveryPoints, discovery));

  const runtimeManifest = JSON.parse(
    readFileSync(join(runtimeRoot, 'manifest.json'), 'utf8')
  );
  const runtimeReceipt = JSON.parse(
    readFileSync(join(runtimeRoot, 'receipts/compiler-wasm.json'), 'utf8')
  );
  const compilerBytes = readFileSync(join(runtimeRoot, 'compiler.wasm'));
  const compilerSha = sha256(compilerBytes);
  let integrityPoints = 0;
  const integrity = {
    compiler_bytes: compilerBytes.length,
    compiler_sha256: compilerSha,
    release_checksum_inventory: null,
    manifest_receipt_match: false,
    compiler_is_wasm: false
  };
  if (fullRelease && existsSync(join(releaseRoot, 'SHA256SUMS'))) {
    const lines = readFileSync(join(releaseRoot, 'SHA256SUMS'), 'utf8')
      .trimEnd()
      .split('\n');
    const seen = new Set();
    let valid = true;
    for (const line of lines) {
      const split = line.indexOf('  ');
      if (split <= 0) {
        valid = false;
        break;
      }
      const expected = line.slice(0, split);
      const relative = line.slice(split + 2);
      if (seen.has(relative) || !existsSync(join(releaseRoot, relative))) {
        valid = false;
        break;
      }
      seen.add(relative);
      if (sha256(readFileSync(join(releaseRoot, relative))) !== expected) {
        valid = false;
        break;
      }
    }
    integrity.release_checksum_inventory = { rows: lines.length, valid };
    if (valid) integrityPoints += 5;
  } else {
    integrity.release_checksum_inventory = { rows: 0, valid: true, mode: 'runtime-only' };
    integrityPoints += 5;
  }
  integrity.manifest_receipt_match =
    compilerBytes.length === runtimeManifest.compiler.file.bytes &&
    compilerBytes.length === runtimeReceipt.compiler.bytes &&
    compilerSha === runtimeManifest.compiler.file.sha256 &&
    compilerSha === runtimeReceipt.compiler.sha256;
  if (integrity.manifest_receipt_match) integrityPoints += 5;
  try {
    await WebAssembly.compile(compilerBytes);
    integrity.compiler_is_wasm = true;
    integrityPoints += 5;
  } catch (_) {
    integrity.compiler_is_wasm = false;
  }
  dimensions.push(scoreDimension('integrity', 15, integrityPoints, integrity));

  const bootstrap = join(runtimeRoot, 'bootstrap.mjs');
  const selfTest = run(process.execPath, [bootstrap, 'self-test'], runtimeRoot);
  assert.equal(selfTest.status, 0, selfTest.stderr);

  const scalarSource = join(temporary, 'novel-scalar.wasmc');
  const scalarWasm = join(temporary, 'novel-scalar.wasm');
  writeFileSync(
    scalarSource,
    'package local:fresh_agent; interface api { run: func(a: s32, b: s32) -> s32 { return a * 3 + b; } } world app { export api; }\n'
  );
  const scalarCompile = run(
    process.execPath,
    [bootstrap, 'compile', '--input', scalarSource, '--output', scalarWasm],
    runtimeRoot
  );
  let scalarPoints = scalarCompile.status === 0 && existsSync(scalarWasm) ? 5 : 0;
  const scalarDetails = { compiled: scalarPoints === 5, imports: null, result: null };
  if (scalarPoints === 5) {
    const bytes = readFileSync(scalarWasm);
    const module = await WebAssembly.compile(bytes);
    const imports = WebAssembly.Module.imports(module);
    scalarDetails.imports = imports;
    if (imports.length === 0) scalarPoints += 5;
    const instance = await WebAssembly.instantiate(module, {});
    scalarDetails.result = instance.exports.run(7, 5);
    if (scalarDetails.result === 26) scalarPoints += 5;
    scalarDetails.output_bytes = bytes.length;
  }
  dimensions.push(scoreDimension('novel-scalar', 15, scalarPoints, scalarDetails));

  const hostSource = join(temporary, 'host.wasmc');
  const hostWasm = join(temporary, 'host.wasm');
  writeFileSync(
    hostSource,
    'package local:fresh_host; interface host { double: func(a: s32) -> s32; } interface api { run: func(a: s32) -> s32 { return double(a) + 3; } } world app { import host; export api; }\n'
  );
  const hostCompile = run(
    process.execPath,
    [bootstrap, 'compile', '--input', hostSource, '--output', hostWasm],
    runtimeRoot
  );
  let hostPoints = 0;
  const hostDetails = { imports: null, missing_binding_rejected: false, result: null };
  if (hostCompile.status === 0 && existsSync(hostWasm)) {
    const bytes = readFileSync(hostWasm);
    const module = await WebAssembly.compile(bytes);
    const imports = WebAssembly.Module.imports(module);
    hostDetails.imports = imports;
    if (
      imports.length === 1 &&
      imports[0].module === 'host' &&
      imports[0].name === 'double' &&
      imports[0].kind === 'function'
    ) {
      hostPoints += 5;
    }
    try {
      await WebAssembly.instantiate(module, {});
    } catch (_) {
      hostDetails.missing_binding_rejected = true;
      hostPoints += 5;
    }
    const instance = await WebAssembly.instantiate(module, {
      host: { double: (value) => value * 2 }
    });
    hostDetails.result = instance.exports.run(9);
    if (hostDetails.result === 21) hostPoints += 5;
    hostDetails.output_bytes = bytes.length;
  }
  dimensions.push(scoreDimension('explicit-host-authority', 15, hostPoints, hostDetails));

  const badSource = join(temporary, 'bad.wasmc');
  const badWasm = join(temporary, 'bad.wasm');
  writeFileSync(
    badSource,
    'package local:bad; interface api { run: func(a: s32) -> s32 { let x: s32 = a + 1 return x; } } world app { export api; }\n'
  );
  const diagnosticRun = run(
    process.execPath,
    [
      bootstrap,
      'compile',
      '--input',
      badSource,
      '--output',
      badWasm,
      '--json-errors'
    ],
    runtimeRoot
  );
  let diagnosticPoints = 0;
  const diagnosticDetails = {
    rejected: diagnosticRun.status !== 0,
    output_absent: !existsSync(badWasm),
    machine_envelope: false,
    compiler_diagnostic: false,
    plain_stderr: diagnosticRun.stderr.trim()
  };
  if (diagnosticDetails.rejected && diagnosticDetails.output_absent) diagnosticPoints += 5;
  try {
    const report = JSON.parse(diagnosticRun.stderr);
    diagnosticDetails.machine_envelope =
      report.schema === 'wasmc.runtime-js-error/v0' &&
      report.accepted === false &&
      report.command === 'compile';
    if (diagnosticDetails.machine_envelope) diagnosticPoints += 5;
    const diagnostic = report.error?.diagnostic;
    diagnosticDetails.compiler_diagnostic =
      diagnostic?.category === 'parse.expected_token' &&
      typeof diagnostic?.message === 'string' &&
      typeof diagnostic?.fix_hint === 'string' &&
      diagnostic.fix_hint.length > 0;
    if (diagnosticDetails.compiler_diagnostic) diagnosticPoints += 5;
    diagnosticDetails.report = report;
  } catch (_) {
    diagnosticDetails.machine_envelope = false;
  }
  if (!diagnosticDetails.machine_envelope || !diagnosticDetails.compiler_diagnostic) {
    findings.push({
      priority: 'P0',
      id: 'runtime-structured-diagnostic-loss',
      summary:
        'Runtime compile failure does not preserve the compiler-owned diagnostic object in a stable machine-readable envelope.'
    });
  }
  dimensions.push(scoreDimension('diagnostics-and-repair', 15, diagnosticPoints, diagnosticDetails));

  let managedPoints = 0;
  const managedCompilerBytes = managedCompilerPath
    ? readFileSync(managedCompilerPath)
    : null;
  const managedCompilerSha = managedCompilerBytes ? sha256(managedCompilerBytes) : null;
  const managedCompilerRuntimeMatch =
    managedCompilerBytes === null || managedCompilerSha === compilerSha;
  const managedDetails = {
    available: false,
    record_backed_result: null,
    recordless_result: null,
    compiler_override: managedCompilerPath !== null,
    compiler_path: managedCompilerPath,
    compiler_sha256: managedCompilerSha,
    runtime_compiler_match: managedCompilerRuntimeMatch
  };
  const facadePath = join(releaseRoot, 'current/wasmc.mjs');
  if (existsSync(facadePath)) {
    managedDetails.available = true;
    const facade = await import(`${pathToFileURL(facadePath).href}?fresh-agent=${Date.now()}`);
    const managedOptions = managedCompilerBytes
      ? { compilerWasmBytes: managedCompilerBytes }
      : undefined;
    const recordBacked = `package local:fresh_inventory;
interface api {
  record Item { sku: string, score: s32 }
  run: func() -> u32 {
    let mut items: list<Item> = list.new();
    items.push({ sku: "alpha", score: 7 });
    items.push({ sku: "beta", score: 9 });
    let mut scores: map<string,s32> = map.new();
    scores.insert("alpha", 7);
    return items.len() + scores.len();
  }
}
world app { export api; }`;
    const recordInstance = await facade.instantiateLib(recordBacked, managedOptions);
    managedDetails.record_backed_result = recordInstance.exports.run();
    if (managedDetails.record_backed_result === 3 && managedCompilerRuntimeMatch) managedPoints += 7;

    const recordless = `package local:fresh_recordless;
interface api {
  run: func() -> u32 {
    let mut names: list<string> = list.new();
    names.push("alpha");
    let mut scores: map<string,s32> = map.new();
    scores.insert("alpha", 7);
    return names.len() + scores.len();
  }
}
world app { export api; }`;
    try {
      const recordlessInstance = await facade.instantiateLib(recordless, managedOptions);
      managedDetails.recordless_result = recordlessInstance.exports.run();
      if (managedDetails.recordless_result === 2 && managedCompilerRuntimeMatch) managedPoints += 3;
    } catch (error) {
      managedDetails.recordless_error = error instanceof Error ? error.message : String(error);
      findings.push({
        priority: 'P1',
        id: 'managed-auto-plan-record-precondition',
        summary:
          'Automatic managed planning rejects standalone String/List/Map source unless at least one record declaration is present.'
      });
    }
  } else {
    managedDetails.mode = 'runtime-only';
  }
  if (!managedCompilerRuntimeMatch) {
    findings.push({
      priority: 'P0',
      id: 'managed-compiler-runtime-drift',
      summary:
        'The managed-value evaluator was given compiler bytes that do not match the candidate Runtime compiler identity.'
    });
  }
  dimensions.push(scoreDimension('managed-values', 10, managedPoints, managedDetails));

  const receipts = {
    node: join(runtimeRoot, 'receipts/node-self-test.json'),
    deno: join(runtimeRoot, 'receipts/deno-self-test.json'),
    bun: join(runtimeRoot, 'receipts/bun-self-test.json')
  };
  let providerPoints = 0;
  const providerDetails = {
    evidence_mode:
      options.candidateCommit === null ? 'legacy-unbound' : 'same-candidate-bound',
    candidate_commit: options.candidateCommit,
    same_source_free_archive: null
  };
  const strictProviderEvidence = options.candidateCommit !== null;
  const providerRows = [];
  for (const [name, path] of Object.entries(receipts)) {
    if (!existsSync(path)) {
      providerDetails[name] = { evidenced: false };
      continue;
    }
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    const legacyMatch = receipt.accepted === true && receipt.runtime === name;
    const sourceFreeArchive = receipt.source_free_package?.archive_sha256;
    const execution = receipt.execution;
    const sameCandidateMatch =
      legacyMatch &&
      receipt.schema === 'wasmc.runtime-js-self-test/v0' &&
      receipt.candidate_commit === options.candidateCommit &&
      receipt.compiler_bytes === compilerBytes.length &&
      receipt.compiler_sha256 === compilerSha &&
      typeof receipt.runtime_version === 'string' &&
      receipt.runtime_version.length > 0 &&
      typeof sourceFreeArchive === 'string' &&
      /^[0-9a-f]{64}$/.test(sourceFreeArchive) &&
      receipt.source_free_package?.private_source_checked_out === false &&
      typeof receipt.host?.hostname === 'string' &&
      receipt.host.hostname.length > 0 &&
      typeof receipt.host?.uname === 'string' &&
      receipt.host.uname.length > 0 &&
      execution?.self_test === true &&
      execution?.compile === true &&
      execution?.compile_output_bytes === 44 &&
      execution?.wasm_validate === true &&
      execution?.instantiate === true &&
      execution?.oracle_export === 'run' &&
      Array.isArray(execution?.oracle_args) &&
      execution.oracle_args.length === 2 &&
      execution.oracle_args[0] === 6 &&
      execution.oracle_args[1] === 18 &&
      execution?.oracle_result === 42;
    const evidenced = strictProviderEvidence ? sameCandidateMatch : legacyMatch;
    providerRows.push({ name, path, receipt, evidenced, sourceFreeArchive });
    providerDetails[name] = {
      evidenced,
      receipt: path,
      compiler_identity_match:
        receipt.compiler_bytes === compilerBytes.length && receipt.compiler_sha256 === compilerSha,
      candidate_commit_match: receipt.candidate_commit === options.candidateCommit,
      source_free_execution: receipt.source_free_package?.private_source_checked_out === false,
      live_execution_complete:
        execution?.self_test === true &&
        execution?.compile === true &&
        execution?.wasm_validate === true &&
        execution?.instantiate === true &&
        execution?.oracle_result === 42,
      runtime_version: receipt.runtime_version ?? null,
      archive_sha256: sourceFreeArchive ?? null
    };
  }
  if (strictProviderEvidence) {
    const archives = new Set(
      providerRows
        .filter((row) => row.evidenced)
        .map((row) => row.sourceFreeArchive)
    );
    providerDetails.same_source_free_archive =
      providerRows.length === 3 && archives.size === 1;
    if (!providerDetails.same_source_free_archive) {
      for (const row of providerRows) {
        row.evidenced = false;
        providerDetails[row.name].evidenced = false;
      }
    }
  }
  for (const [name] of Object.entries(receipts)) {
    if (providerDetails[name]?.evidenced) providerPoints += name === 'node' ? 4 : 3;
  }
  if (strictProviderEvidence) {
    for (const name of ['node', 'deno']) {
      if (!providerDetails[name]?.evidenced) {
        findings.push({
          priority: 'P1',
          id: `${name}-live-evidence-mismatch`,
          summary: `The ${name} Host evidence is not bound to the exact candidate commit/compiler and complete source-free execution.`
        });
      }
    }
  }
  if (!providerDetails.bun.evidenced) {
    findings.push({
      priority: 'P2',
      id: 'bun-live-evidence-missing',
      summary: 'The Bun Host adapter has no independent accepted live self-test receipt.'
    });
  }
  dimensions.push(scoreDimension('host-provider-evidence', 10, providerPoints, providerDetails));

  const runtimePythonFiles = collectPythonFiles(runtimeRoot);
  // The Runtime manifest is the machine-readable policy authority; the evaluator
  // also checks the known package tree explicitly without invoking Python/npm.
  const policyDetails = {
    external_js_package_registry:
      runtimeManifest.distribution?.external_js_package_registry,
    python_active_tree_allowed:
      runtimeManifest.policy?.python_active_tree_allowed ?? false,
    evaluation_used_external_packages: false,
    runtime_python_files: runtimePythonFiles
  };
  let policyPoints = 0;
  if (
    policyDetails.external_js_package_registry === false &&
    policyDetails.python_active_tree_allowed === false &&
    runtimePythonFiles.length === 0
  ) {
    policyPoints = 5;
  }
  dimensions.push(scoreDimension('policy-boundary', 5, policyPoints, policyDetails));

  const score = dimensions.reduce((sum, row) => sum + row.points, 0);
  const maxScore = dimensions.reduce((sum, row) => sum + row.weight, 0);
  const dimension = (id) => dimensions.find((row) => row.id === id);
  const criticalPass =
    dimension('discovery').points >= 12 &&
    dimension('integrity').passed &&
    dimension('novel-scalar').passed &&
    dimension('explicit-host-authority').passed &&
    dimension('diagnostics-and-repair').points >= 5 &&
    dimension('policy-boundary').passed;
  const priorityOrder = new Map([
    ['P0', 0],
    ['P1', 1],
    ['P2', 2],
    ['P3', 3]
  ]);
  findings.sort(
    (left, right) =>
      (priorityOrder.get(left.priority) ?? 99) -
        (priorityOrder.get(right.priority) ?? 99) ||
      left.id.localeCompare(right.id)
  );
  const report = {
    schema: 'wasmc.fresh-agent-evaluation/v0',
    accepted: criticalPass && score >= 80,
    release_root: releaseRoot,
    guidance_root: guidanceRoot,
    guidance_override: options.guidanceRoot !== null,
    runtime_root: runtimeRoot,
    runtime_override: options.runtimeRoot !== null,
    managed_compiler: managedCompilerPath,
    managed_compiler_override: options.managedCompiler !== null,
    candidate_commit: options.candidateCommit,
    strict_host_provider_evidence: strictProviderEvidence,
    release: fullRelease && existsSync(join(releaseRoot, 'release.json'))
      ? JSON.parse(readFileSync(join(releaseRoot, 'release.json'), 'utf8').toString())
          .version
      : null,
    runtime: {
      id: runtimeManifest.id,
      version: runtimeManifest.version,
      compiler_bytes: compilerBytes.length,
      compiler_sha256: compilerSha
    },
    score: { points: score, maximum: maxScore, percent: score },
    dimensions,
    findings,
    next_priority: findings[0] ?? null
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.jsonOut) writeFileSync(absolute(options.jsonOut), output);
  process.stdout.write(output);
  if (!report.accepted) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
