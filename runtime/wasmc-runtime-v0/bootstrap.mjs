#!/usr/bin/env node
import { runCli } from './host/common.mjs';

async function runtimeHost() {
  if (typeof globalThis.Deno !== 'undefined') {
    const mod = await import('./host/deno.mjs');
    return mod.createHost(import.meta.url);
  }
  if (typeof globalThis.Bun !== 'undefined') {
    const mod = await import('./host/bun.mjs');
    return mod.createHost(import.meta.url);
  }
  const mod = await import('./host/node.mjs');
  return mod.createHost(import.meta.url);
}

function runtimeArgs() {
  if (typeof globalThis.Deno !== 'undefined') return globalThis.Deno.args;
  if (typeof globalThis.Bun !== 'undefined') return globalThis.Bun.argv.slice(2);
  return process.argv.slice(2);
}

try {
  await runCli(await runtimeHost(), runtimeArgs());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof console !== 'undefined') console.error(message);
  if (typeof globalThis.Deno !== 'undefined') globalThis.Deno.exit(1);
  if (typeof process !== 'undefined') process.exitCode = 1;
}
