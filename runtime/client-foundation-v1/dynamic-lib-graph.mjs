import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

export async function inspectDynamicLibPackage(packageRoot) {
  const root = await realpath(packageRoot);
  const descriptorPath = path.join(root, "native-boundary.json");
  const descriptorBytes = await readFile(descriptorPath);
  const descriptor = JSON.parse(descriptorBytes);
  if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1" || typeof descriptor.identity !== "string" || descriptor.identity.length === 0) {
    throw new Error("invalid dynamic Lib descriptor identity");
  }
  if (typeof descriptor.wit !== "string" || typeof descriptor.adapter?.path !== "string") {
    throw new Error("incomplete dynamic Lib package identity");
  }
  const files = [
    ["native-boundary.json", descriptorPath, descriptorBytes],
    [descriptor.wit, await realpath(path.resolve(root, descriptor.wit))],
    [descriptor.adapter.path, await realpath(path.resolve(root, descriptor.adapter.path))],
  ];
  if (files.some(([, file]) => !within(root, file))) throw new Error("dynamic Lib package file escapes exact root");
  const digest = createHash("sha256");
  for (const [name, file, knownBytes] of files.sort(([left], [right]) => left.localeCompare(right))) {
    const bytes = knownBytes ?? await readFile(file);
    digest.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`);
    digest.update(bytes);
  }
  return { identity: descriptor.identity, artifact_sha256: digest.digest("hex") };
}

export class DynamicLibGraph {
  constructor({ boundary }) {
    if (!boundary) throw new Error("DynamicLibGraph requires the fixed Host boundary");
    this.boundary = boundary;
    this.active = { revision: 0, blocks: new Map(), pipeline: [], inflight: 0, drainWaiters: [] };
    this.closed = false;
    this.updateInProgress = false;
  }

  snapshot() {
    return {
      revision: this.active.revision,
      pipeline: [...this.active.pipeline],
      blocks: Object.fromEntries([...this.active.blocks].map(([name, block]) => [name, { identity: block.identity, artifact_sha256: block.artifactSha }])),
    };
  }

  async apply({ expected_revision, blocks, pipeline }) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    if (this.updateInProgress) throw new Error("dynamic Lib graph update already in progress");
    if (expected_revision !== this.active.revision) throw new Error("dynamic Lib graph revision fence mismatch");
    if (!Array.isArray(blocks) || !Array.isArray(pipeline) || blocks.length === 0 || pipeline.length === 0) throw new Error("incomplete dynamic Lib graph");
    const desired = new Map();
    for (const block of blocks) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(block.name) || desired.has(block.name) || typeof block.root !== "string" || typeof block.identity !== "string" || !/^[a-f0-9]{64}$/.test(block.artifact_sha256)) {
        throw new Error("invalid dynamic Lib block declaration");
      }
      desired.set(block.name, block);
    }
    if (pipeline.some((name) => !desired.has(name))) throw new Error("dynamic Lib pipeline references an absent block");

    const old = this.active;
    const candidateBlocks = new Map();
    const installed = [];
    let reused = 0;
    let published = false;
    this.updateInProgress = true;
    try {
      for (const [name, declaration] of desired) {
        const current = old.blocks.get(name);
        if (current?.artifactSha === declaration.artifact_sha256) {
          if (current.identity !== declaration.identity) throw new Error(`dynamic Lib identity conflicts with retained artifact: ${name}`);
          candidateBlocks.set(name, current);
          reused += 1;
          continue;
        }
        const exact = await inspectDynamicLibPackage(declaration.root);
        if (exact.identity !== declaration.identity) throw new Error(`dynamic Lib descriptor identity mismatch: ${name}`);
        if (exact.artifact_sha256 !== declaration.artifact_sha256) throw new Error(`dynamic Lib package identity mismatch: ${name}`);
        const resource = await this.boundary.install(declaration.root);
        const record = { resource, artifactSha: declaration.artifact_sha256, identity: declaration.identity };
        installed.push(record);
        candidateBlocks.set(name, record);
        await this.#call(resource, { operation: "probe" });
        await this.#call(resource, { operation: "health" });
      }
      const candidate = {
        revision: old.revision + 1,
        blocks: candidateBlocks,
        pipeline: [...pipeline],
        inflight: 0,
        drainWaiters: [],
      };
      for (const block of candidate.blocks.values()) await this.#call(block.resource, { operation: "health" });
      this.active = candidate;
      published = true;
      await this.#drain(old);
      const retainedResources = new Set([...candidate.blocks.values()].map((block) => block.resource));
      let released = 0;
      for (const block of new Set(old.blocks.values())) {
        if (!retainedResources.has(block.resource)) {
          this.boundary.releaseResource(block.resource);
          released += 1;
        }
      }
      return { outcome: "committed", revision: candidate.revision, installed: installed.length, reused, released, pipeline: [...pipeline] };
    } catch (error) {
      if (published) {
        return { outcome: "committed", revision: this.active.revision, installed: installed.length, reused, released: 0, cleanup_error: error.message, pipeline: [...this.active.pipeline] };
      }
      this.active = old;
      for (const block of installed) this.boundary.releaseResource(block.resource);
      return { outcome: "rolled-back", revision: old.revision, installed: installed.length, reused, released: installed.length, error: error.message, pipeline: [...old.pipeline] };
    } finally {
      this.updateInProgress = false;
    }
  }

  async invoke(value) {
    if (this.closed) throw new Error("dynamic Lib graph closed");
    const generation = this.active;
    generation.inflight += 1;
    try {
      let current = value;
      for (const name of generation.pipeline) {
        const response = await this.#call(generation.blocks.get(name).resource, { operation: "invoke", value: current });
        if (response.accepted !== true) throw new Error(`dynamic Lib block rejected invocation: ${name}`);
        current = response.value;
      }
      return { revision: generation.revision, value: current };
    } finally {
      generation.inflight -= 1;
      if (generation.inflight === 0) {
        for (const resolve of generation.drainWaiters.splice(0)) resolve();
      }
    }
  }

  async close() {
    if (this.closed) return;
    if (this.updateInProgress) throw new Error("cannot close dynamic Lib graph during an update");
    this.closed = true;
    await this.#drain(this.active);
    for (const block of new Set(this.active.blocks.values())) this.boundary.releaseResource(block.resource);
    this.active.blocks.clear();
  }

  async #drain(generation) {
    if (generation.inflight === 0) return;
    await new Promise((resolve) => generation.drainWaiters.push(resolve));
  }

  async #call(resource, request) {
    const window = this.boundary.acquireWindow(encoder.encode(JSON.stringify(request)));
    const operation = this.boundary.submit(resource, window);
    try {
      await this.boundary.wait([operation]);
      const completion = this.boundary.claim(operation);
      if (completion.state !== "completed") throw new Error(completion.error ?? completion.state);
      return JSON.parse(decoder.decode(completion.bytes));
    } finally {
      try { this.boundary.releaseOperation(operation); } finally { this.boundary.releaseWindow(window); }
    }
  }
}
