#!/usr/bin/env node
import { main } from "./index.mjs";

const args = typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2);
const status = await main(args);
if (typeof Deno !== "undefined") Deno.exit(status);
process.exitCode = status;
