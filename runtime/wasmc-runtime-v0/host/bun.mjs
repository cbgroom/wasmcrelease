// Bun path intentionally uses the Node-compatible filesystem authority that Bun implements.
// Bun is a Host provider here, not a package registry dependency.
import { createHost as createNodeCompatibleHost } from './node.mjs';

export function createHost(runtimeUrl) {
  const host = createNodeCompatibleHost(runtimeUrl);
  return { ...host, name: 'bun' };
}
