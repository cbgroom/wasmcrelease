# Ordinary unit Result matching

These are public source-neutral conformance fixtures, not a production Host contract. The WIT/binding use the existing FastABI pinned-artifact protocol. Execution/provider description bytes document only this mock test. Host functions keep in-memory counters; no network, files or platform effects are granted.

A WIT unit success is matched as `ok => ...`, with no payload binding. The complete owned error variant must be exhausted. Both terminal and nested continuing matches call each selected operation once; malformed success statuses reject and retire the existing cleanup set before trap. The test repeats calls and recovers in the same instance.

Run `node scripts/test-unit-result-match.mjs` from the release root. The same script runs with Bun and Deno.
