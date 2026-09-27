import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const copyBytes = (value) => {
  if (!(value instanceof Uint8Array)) throw new TypeError("boundary values must be Uint8Array");
  return Uint8Array.from(value);
};

export class LibDefinedBoundary {
  #next = 1;
  #resources = new Map();
  #windows = new Map();
  #operations = new Map();

  async install(packageRoot) {
    const root = await realpath(packageRoot);
    const descriptorPath = path.join(root, "native-boundary.json");
    const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
    if (descriptor.schema !== "wasmc.native-boundary-descriptor/v1") throw new Error("unsupported descriptor schema");
    if (typeof descriptor.identity !== "string" || descriptor.identity.length === 0) throw new Error("missing exact Lib identity");
    const adapter = descriptor.adapter;
    if (!adapter || typeof adapter.path !== "string" || typeof adapter.sha256 !== "string" || typeof adapter.export !== "string") throw new Error("incomplete adapter identity");
    const adapterPath = await realpath(path.resolve(root, adapter.path));
    if (adapterPath !== root && !adapterPath.startsWith(`${root}${path.sep}`)) throw new Error("adapter escapes exact Lib root");
    const adapterBytes = await readFile(adapterPath);
    if (sha256(adapterBytes) !== adapter.sha256) throw new Error("adapter identity mismatch");
    const module = await import(`${pathToFileURL(adapterPath).href}?sha256=${adapter.sha256}`);
    const invoke = module[adapter.export];
    if (typeof invoke !== "function") throw new Error("adapter export missing");
    const resource = this.#next++;
    this.#resources.set(resource, {
      identity: descriptor.identity,
      invoke,
      maxInputBytes: descriptor.limits?.max_input_bytes,
      maxOutputBytes: descriptor.limits?.max_output_bytes,
      released: false,
    });
    return resource;
  }

  acquireWindow(bytes) {
    const window = this.#next++;
    this.#windows.set(window, { bytes: copyBytes(bytes), pinned: false, released: false });
    return window;
  }

  submit(resourceId, windowId) {
    const resource = this.#resource(resourceId);
    const window = this.#window(windowId);
    if (window.pinned) throw new Error("window busy");
    if (!Number.isSafeInteger(resource.maxInputBytes) || window.bytes.length > resource.maxInputBytes) throw new Error("input limit");
    window.pinned = true;
    const controller = new AbortController();
    const operation = this.#next++;
    const record = {
      resourceId,
      windowId,
      state: "pending",
      claimed: false,
      cancelRequested: false,
      output: null,
      error: null,
      controller,
      promise: null,
    };
    record.promise = Promise.resolve()
      .then(() => resource.invoke(Uint8Array.from(window.bytes), { signal: controller.signal }))
      .then((output) => {
        const bytes = copyBytes(output);
        if (!Number.isSafeInteger(resource.maxOutputBytes) || bytes.length > resource.maxOutputBytes) throw new Error("output limit");
        if (record.cancelRequested) record.state = "cancelled";
        else {
          record.output = bytes;
          record.state = "completed";
        }
      })
      .catch((error) => {
        if (record.cancelRequested) record.state = "cancelled";
        else {
          record.error = error instanceof Error ? error.message : String(error);
          record.state = "failed";
        }
      })
      .finally(() => { window.pinned = false; });
    this.#operations.set(operation, record);
    return operation;
  }

  cancel(operationId) {
    const operation = this.#operation(operationId);
    if (operation.state !== "pending") return false;
    operation.cancelRequested = true;
    operation.controller.abort();
    return true;
  }

  async wait(operationIds) {
    const operations = operationIds.map((id) => this.#operation(id));
    await Promise.all(operations.map((operation) => operation.promise));
    return operationIds.map((id) => ({ operation: id, state: this.#operation(id).state }));
  }

  claim(operationId) {
    const operation = this.#operation(operationId);
    if (operation.state === "pending") throw new Error("operation pending");
    if (operation.claimed) throw new Error("completion already claimed");
    operation.claimed = true;
    return {
      state: operation.state,
      bytes: operation.output ? Uint8Array.from(operation.output) : null,
      error: operation.error,
    };
  }

  releaseOperation(operationId) {
    const operation = this.#operation(operationId);
    if (operation.state === "pending") throw new Error("operation pending");
    if (!operation.claimed) throw new Error("completion unclaimed");
    this.#operations.delete(operationId);
  }

  releaseWindow(windowId) {
    const window = this.#window(windowId);
    if (window.pinned) throw new Error("window busy");
    window.released = true;
    this.#windows.delete(windowId);
  }

  releaseResource(resourceId) {
    const resource = this.#resource(resourceId);
    if ([...this.#operations.values()].some((operation) => operation.resourceId === resourceId)) throw new Error("resource busy");
    resource.released = true;
    this.#resources.delete(resourceId);
  }

  counts() {
    return { resources: this.#resources.size, windows: this.#windows.size, operations: this.#operations.size };
  }

  #resource(id) {
    const value = this.#resources.get(id);
    if (!value || value.released) throw new Error("invalid resource");
    return value;
  }

  #window(id) {
    const value = this.#windows.get(id);
    if (!value || value.released) throw new Error("invalid window");
    return value;
  }

  #operation(id) {
    const value = this.#operations.get(id);
    if (!value) throw new Error("invalid operation");
    return value;
  }
}
