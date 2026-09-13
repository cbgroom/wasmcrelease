# Pinned download and no-clobber installation

This tooling ships in v0.0.10, not immutable v0.0.9. Pin the release or a full
supplemental tooling commit and verify SHA256SUMS first. Installation still uses
the independently pinned four-package catalog snapshot, not search selection.
The downloaded package bytes are pinned to public commit
`0fec38d59872a7f1527dc94799da542e968f1f8a`.

## Complete standard Lib journey

Run from the verified tooling checkout on Unix Node/Bun/Deno:

```bash
wasmc_install_demo=$(mktemp -d)
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.0 \
  --catalog-sha256 13fe84e7faf77467b45d97460e9cd9fa1ba7d17c17b0175fb16ce5d694c82d82 \
  --wit-sha256 d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d \
  --artifact-sha256 f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7 \
  > "$wasmc_install_demo/lock.json"
node scripts/wasmc-lib.mjs install "$wasmc_install_demo/lock.json" \
  "$wasmc_install_demo/lib" \
  --lock-sha256 63806ae6ee83164fd955753091cbfe74dac689d29c29a5371eadfc07b0ca1953 \
  --mirror github
node examples/current/standard.mjs --installed "$wasmc_install_demo/lib"
```

Choose `--mirror jsdelivr` explicitly to use jsDelivr. There is no mirror
fallback, unversioned URL, custom endpoint, semver solving or redirect following.
The lock SHA above binds the exact pretty-printed resolve output including its
newline. If formatting changes, approve the new lock bytes/SHA independently;
do not silently replace a previously approved pin with a runtime-computed value.

The destination contains the exact root at `standard/wasmc-std/1.4.0` and its
CoreLib companion at `standard/corelib/4.8.0`. Read the root SKILL/WIT and retain
the matching companion. The Host example compiles with the tooling checkout's
compiler but loads Lib/plan/CoreLib from the new installation, then compares
independent WAsmC and Rust App calls. It does not claim to install a compiler.

Bun uses the same commands. Deno install CLI needs `--allow-read --allow-write
--allow-net=raw.githubusercontent.com,cdn.jsdelivr.net`; its standard execution
example needs `--allow-read`. These are explicit tooling permissions, not App
capabilities. Check [artifact/engine compatibility](../compatibility/README.md)
separately: downloading successfully does not prove Node18 can execute standard.

## Publication, limits and failure behavior

The caller's exact lock and catalog/WIT/artifact identities are validated before
network selection. Every listed package file plus companion is fetched from the
fixed HTTPS mirror at the exact commit, with manual redirects, exact streamed
length and SHA-256 checks. Limits are 16MiB/file, 128MiB total, 15s/request and
120s overall network/publication deadline. There is no retry or ignored failure.
Successful complete files are flushed, then the resolver rechecks the complete
staged package and compares its receipt to the approved lock.

The installer creates a private sibling backing directory, then publishes the
requested destination as a relative directory symlink with exclusive creation.
Symlink creation cannot overwrite an existing file, directory or symlink; two
concurrent installers have only one winner. Failed unpublished staging is
removed. The successful backing directory must remain alongside the symlink:
copying only the pointer or removing the hidden directory breaks the installation.
This is a Unix atomic-visibility mechanism, not a Windows implementation.

Existing installations are never overwritten, updated or garbage-collected.
For a changed version choose a new destination and explicitly switch your own
application reference. Unexpected process termination may leave an unpublished
private sibling directory; no automatic orphan cleanup is provided. File flushes
and atomic visibility do not constitute a power-loss/directory-fsync durability
guarantee, signed-package authentication or protection from a separate local user
mutating files after installation. Verify exact bytes again at your admission
boundary. There is no module instantiation, import authorization, SDK mutation,
language-memory change or hot-call overhead in installation.

## Executable qualification

```bash
node scripts/test-lib-install.mjs
node scripts/validate-lib-install.mjs github
node scripts/validate-lib-install.mjs jsdelivr
bun scripts/validate-lib-install.mjs github
deno run --allow-read --allow-write --allow-env=TMPDIR,TMP,TEMP \
  --allow-run scripts/validate-lib-install.mjs github
```

The controlled transport suite tests ten failure boundaries, concurrent single
winner, competing-directory preservation and failed-stage cleanup. It uses no
network. The live harness invokes the actual install CLI with a cleared child
environment, verifies fresh downloaded bytes, then runs 5,120 paired consumer
checks. Deno uses its native child launcher, not Node-compat environment copying.
Temporary-fixture permissions belong only to this harness.

Evidence is in [public install qualification](../admission/public-lib-install-v009.json).
[Linux CI](https://github.com/cbgroom/wasmcrelease/actions/runs/34730052200)
passed seven JavaScript/compatibility/integrity jobs including fresh install and
installed execution on Node/Bun/Deno. The full Rust rebuild was still running
at this checkpoint; consult its live status before calling the whole run green.
The delivery closure now has compatibility, offline catalog/exact resolve and
pinned download/install implemented (3/4, 75%); public third-party Lib build
remains. This denominator is not complete standard-library coverage or System/
Ultra readiness. New Lib authoring must reuse the existing private source-authority
WIT/root build mechanism rather than duplicating it in this delivery repository.
