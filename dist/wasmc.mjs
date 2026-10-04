#!/usr/bin/env node
export * from '../current/wasmc.mjs';
import { main } from '../current/wasmc.mjs';
const invoked = typeof Deno !== 'undefined' ? import.meta.main :
  typeof process !== 'undefined' && process.argv[1] &&
  new URL(import.meta.url).pathname === process.argv[1];
if (invoked) {
  const status = await main(typeof Deno !== 'undefined' ? Deno.args : process.argv.slice(2));
  if (typeof Deno !== 'undefined') Deno.exit(status);
  else process.exitCode = status;
}
