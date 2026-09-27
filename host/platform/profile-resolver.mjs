import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROFILE_SCHEMA = "wasmc.library-os-profile/v2";
const REQUEST_SCHEMA = "wasmc.system-profile-request/v1";
const CANDIDATE_SCHEMA = "wasmc.libsrc-candidate/v1";
const NATIVE_DESCRIPTOR_SCHEMA = "wasmc.native-boundary-descriptor/v1";
const PLATFORM_DESCRIPTOR_SCHEMA = "wasmc.platform-binding-descriptor/v1";
const TARGET_FIELDS = ["os", "architecture", "environment", "embedding"];
const LIFECYCLE_STAGES = ["qualified", "admitted", "released", "discoverable", "installable"];

export class ProfileResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProfileResolutionError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new ProfileResolutionError(code, message, details);
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function validateTarget(target, context) {
  if (!isObject(target)) fail("target.invalid", `${context} target must be an object`);
  const keys = Object.keys(target).sort();
  const expected = [...TARGET_FIELDS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    fail("target.invalid", `${context} target must contain exactly ${TARGET_FIELDS.join(", ")}`, { target });
  }
  for (const field of TARGET_FIELDS) {
    if (typeof target[field] !== "string" || target[field].length === 0) {
      fail("target.invalid", `${context} target.${field} must be a non-empty string`, { target });
    }
  }
}

function safeRelativePath(root, relative, context) {
  if (typeof relative !== "string" || relative.length === 0 || path.isAbsolute(relative)) {
    fail("package.path_invalid", `${context} must be a non-empty relative path`, { path: relative });
  }
  const resolved = path.resolve(root, relative);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    fail("package.path_invalid", `${context} escapes the package root`, { path: relative });
  }
  return resolved;
}

function validateLifecycle(lifecycle, context) {
  if (!isObject(lifecycle)) fail("lifecycle.invalid", `${context} lifecycle must be an object`);
  let previous = true;
  for (const stage of LIFECYCLE_STAGES) {
    if (typeof lifecycle[stage] !== "boolean") {
      fail("lifecycle.invalid", `${context} lifecycle.${stage} must be boolean`);
    }
    if (lifecycle[stage] && !previous) {
      fail("lifecycle.invalid", `${context} lifecycle stages must be monotonic`, { lifecycle });
    }
    previous = lifecycle[stage];
  }
}

export function loadSystemLibCandidate(root, candidatePath) {
  const absoluteCandidate = safeRelativePath(root, candidatePath, "candidate path");
  const candidate = JSON.parse(fs.readFileSync(absoluteCandidate, "utf8"));
  if (candidate.schema !== CANDIDATE_SCHEMA) {
    fail("package.invalid", `${candidatePath} has an unsupported candidate schema`);
  }
  const binding = candidate.system_binding;
  if (!isObject(binding) || typeof binding.implements !== "string") {
    fail("package.binding_missing", `${candidatePath} has no exact system_binding metadata`);
  }
  if (typeof binding.boundary !== "string" || typeof binding.descriptor !== "string") {
    fail("package.binding_invalid", `${candidatePath} has an incomplete native binding declaration`);
  }
  if (!Array.isArray(binding.targets) || binding.targets.length === 0) {
    fail("package.target_missing", `${candidatePath} has no declared target`);
  }
  binding.targets.forEach((target, index) => validateTarget(target, `${candidatePath} targets[${index}]`));
  validateLifecycle(binding.lifecycle, candidatePath);

  const candidateRoot = path.dirname(absoluteCandidate);
  const witAbsolute = safeRelativePath(candidateRoot, candidate.wit, "WIT path");
  const witSource = fs.readFileSync(witAbsolute, "utf8");
  const witPackage = witSource.match(/^package\s+([^;]+);/m)?.[1];
  if (witPackage !== binding.implements) {
    fail("package.wit_mismatch", `${candidatePath} system_binding does not match its WIT package`, {
      declared: binding.implements, wit_package: witPackage ?? null,
    });
  }
  const descriptorAbsolute = safeRelativePath(candidateRoot, binding.descriptor, "descriptor path");
  const descriptor = JSON.parse(fs.readFileSync(descriptorAbsolute, "utf8"));
  if (![NATIVE_DESCRIPTOR_SCHEMA, PLATFORM_DESCRIPTOR_SCHEMA].includes(descriptor.schema)) {
    fail("descriptor.invalid", `${candidatePath} has an unsupported descriptor schema`);
  }
  if (descriptor.wit !== candidate.wit) {
    fail("descriptor.wit_mismatch", `${candidatePath} candidate and descriptor WIT paths differ`);
  }
  let artifact;
  if (descriptor.schema === NATIVE_DESCRIPTOR_SCHEMA) {
    if (!isObject(descriptor.adapter) || path.basename(descriptor.adapter.path) !== descriptor.adapter.path) {
      fail("descriptor.adapter_invalid", `${candidatePath} adapter must be an exact sibling filename`);
    }
    artifact = { format: "native-adapter", path: descriptor.adapter.path };
  } else {
    validateTarget(descriptor.target, `${candidatePath} descriptor`);
    if (!binding.targets.some((target) => sameTarget(target, descriptor.target))) {
      fail("descriptor.target_mismatch", `${candidatePath} descriptor target is not declared by the candidate`);
    }
    if (!isObject(descriptor.artifact) || descriptor.artifact.format !== "embedded-source") {
      fail("descriptor.artifact_invalid", `${candidatePath} platform descriptor must declare embedded-source`);
    }
    if (!Array.isArray(descriptor.artifact.sources) || descriptor.artifact.sources.length === 0) {
      fail("descriptor.artifact_invalid", `${candidatePath} embedded-source must list source files`);
    }
    const sources = descriptor.artifact.sources.map((source, index) => {
      const absolute = safeRelativePath(candidateRoot, source, `embedded source[${index}]`);
      if (!fs.statSync(absolute).isFile()) {
        fail("descriptor.artifact_invalid", `${candidatePath} embedded source is not a file`, { source });
      }
      return path.relative(root, absolute);
    });
    if (!Array.isArray(descriptor.artifact.frameworks) ||
        descriptor.artifact.frameworks.some((framework) => typeof framework !== "string" || !framework)) {
      fail("descriptor.artifact_invalid", `${candidatePath} embedded-source frameworks must be strings`);
    }
    artifact = {
      format: descriptor.artifact.format,
      language: descriptor.artifact.language,
      linkage: descriptor.artifact.linkage,
      sources,
      frameworks: descriptor.artifact.frameworks,
    };
  }
  if (binding.artifact_format !== artifact.format) {
    fail("package.artifact_invalid", `${candidatePath} candidate and descriptor artifact formats differ`);
  }

  return {
    api: binding.implements,
    provider: descriptor.identity,
    candidate: candidatePath,
    wit: path.relative(root, witAbsolute),
    descriptor: path.relative(root, descriptorAbsolute),
    boundary: binding.boundary,
    artifact,
    targets: binding.targets,
    lifecycle: binding.lifecycle,
  };
}

const sameTarget = (left, right) => TARGET_FIELDS.every((field) => left[field] === right[field]);

export function resolveSystemProfile(request, candidates) {
  if (!isObject(request) || request.schema !== REQUEST_SCHEMA) {
    fail("request.invalid", `request schema must be ${REQUEST_SCHEMA}`);
  }
  validateTarget(request.target, "request");
  if (!Array.isArray(request.requirements) || request.requirements.length === 0) {
    fail("request.invalid", "request requirements must be a non-empty array");
  }
  if (new Set(request.requirements).size !== request.requirements.length) {
    fail("request.requirement_duplicate", "request requirements must be unique");
  }
  const requiredLifecycle = request.required_lifecycle ?? "qualified";
  if (!LIFECYCLE_STAGES.includes(requiredLifecycle)) {
    fail("request.lifecycle_invalid", `unsupported required lifecycle ${requiredLifecycle}`);
  }
  const pins = request.pins ?? {};
  if (!isObject(pins)) fail("request.pin_invalid", "request pins must be an object");

  const providerIdentities = candidates.map((candidate) => candidate.provider);
  if (new Set(providerIdentities).size !== providerIdentities.length) {
    fail("provider.identity_duplicate", "candidate provider identities must be unique");
  }

  const bindings = request.requirements.map((api) => {
    const targetMatches = candidates.filter((candidate) =>
      candidate.api === api &&
      candidate.boundary === request.boundary &&
      candidate.targets.some((target) => sameTarget(target, request.target)));
    const lifecycleMatches = targetMatches.filter((candidate) => candidate.lifecycle[requiredLifecycle] === true);
    const pinnedProvider = pins[api];
    const matches = pinnedProvider === undefined
      ? lifecycleMatches
      : lifecycleMatches.filter((candidate) => candidate.provider === pinnedProvider);
    if (pinnedProvider !== undefined && matches.length === 0) {
      fail("provider.pin_unmatched", `pinned provider does not satisfy ${api}`, {
        api, provider: pinnedProvider, target: request.target, required_lifecycle: requiredLifecycle,
      });
    }
    if (matches.length === 0) {
      fail("provider.none", `no provider satisfies ${api}`, {
        api,
        target: request.target,
        boundary: request.boundary,
        required_lifecycle: requiredLifecycle,
        target_matches: targetMatches.map((candidate) => candidate.provider),
      });
    }
    if (matches.length > 1) {
      fail("provider.ambiguous", `multiple providers satisfy ${api}; add an exact pin`, {
        api, providers: matches.map((candidate) => candidate.provider), target: request.target,
      });
    }
    const selected = matches[0];
    return {
      api: selected.api,
      provider: selected.provider,
      candidate: selected.candidate,
      wit: selected.wit,
      descriptor: selected.descriptor,
      boundary: selected.boundary,
      artifact: selected.artifact,
      target: request.target,
      lifecycle: selected.lifecycle,
    };
  });

  return {
    schema: PROFILE_SCHEMA,
    id: request.id,
    target: request.target,
    host: request.host,
    required_lifecycle: requiredLifecycle,
    requirements: request.requirements,
    bindings,
    acceptance: request.acceptance,
  };
}

export function resolveSystemProfileRequest(root, request) {
  if (!isObject(request) || !Array.isArray(request.candidates) || request.candidates.length === 0) {
    fail("request.invalid", "request candidates must be a non-empty array");
  }
  const candidates = request.candidates.map((candidatePath) =>
    loadSystemLibCandidate(root, candidatePath));
  return resolveSystemProfile(request, candidates);
}

function runCli() {
  const [command, requestPath, outputPath] = process.argv.slice(2);
  if (command !== "resolve" || !requestPath) {
    console.error("usage: node host/platform/profile-resolver.mjs resolve <request.json> [output.json]");
    process.exit(2);
  }
  try {
    const root = process.cwd();
    const request = JSON.parse(fs.readFileSync(path.resolve(root, requestPath), "utf8"));
    const profile = resolveSystemProfileRequest(root, request);
    const encoded = `${JSON.stringify(profile, null, 2)}\n`;
    if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), encoded);
    else process.stdout.write(encoded);
  } catch (error) {
    if (error instanceof ProfileResolutionError) {
      console.error(JSON.stringify({ accepted: false, code: error.code, message: error.message, details: error.details }));
      process.exit(1);
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
