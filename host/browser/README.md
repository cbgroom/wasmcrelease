# Real browser Core App/Lib Host probe

The same frozen WAsmC App and reviewed owned-algorithms Core Lib execute in
the real browser WebAssembly engine. Public ESM bindings/guards/drivers are
imported directly, not bundled with Node shims. WebCrypto issues session
identities. This is a computation/ownership probe, not browser raw TCP or
filesystem support. Native TCP backends remain separate deployment features.

```sh
node host/browser/server.mjs
# In a separate terminal, use its printed loopback URL:
npm exec --yes --package=@playwright/cli@0.1.19 -- playwright-cli -s=wasmc-host open URL --browser chrome
npm exec --yes --package=@playwright/cli@0.1.19 -- playwright-cli -s=wasmc-host --raw eval 'async () => await globalThis.receiptPromise'
npm exec --yes --package=@playwright/cli@0.1.19 -- playwright-cli -s=wasmc-host close
```

Run CLI from a temporary directory (local artifacts under
`target/browser-probe/output/playwright`), never publish its profiles/snapshots
inside the source-free inventory. The fixture server compiles the guest with
the public compiler, binds loopback only, serves a fixed GET allowlist and no
ambient directory access. Stop it after testing. Artifact digests are checked
in-browser. No provider/compiler rebuild or production Host grant is involved.

Probe asserts 1000 resident calls plus four size cases, budget rejection before
Lib call, post-Lib trap poisoning/no replay, four cancelled-window/foreign-ticket
controls and four synchronous/async failed-stop ownership cases. `resource_cleanup`
means App slab and normal guards; `quarantine_retained` means failed-stop owners
are deliberately retained in the page supervisor until teardown. It does not
mean all resources freed after a failed close. Backends in those four failure
controls are deterministic fixtures, not real browser device I/O.

The same scalar Host kernel guest also runs four size cases against MemoryHost,
with a digest checked against Native Wasmi/Wasmtime receipts. The simulator's
cancel behavior is not a real asynchronous I/O backend; do not use it in place
of the completion pin/close fences. Browser supervisor admission/recovery is
additionally exercised once with a deliberately failed-close fixture.

Mutable probes also assert three completion snapshot/reentry cases and one
TCP-driver write snapshot case. Getter/Proxy length is captured once; a nested
completion cannot be overwritten by the outer call. These deterministic glue
controls are not real browser network I/O. Their separate receipt counters are
required by Actions, alongside all earlier guard/stop/supervisor counters.
One idle-guard reuse/stale-ticket probe is also required: stale completion must
not alter the next pending window on that same scoped guard. Trusted temporary
test hooks restore in finally and expose no tickets in the published receipt.
One explicit-quarantine retirement probe also omits the final internal release
acknowledgement after mutation. Even zero records retain quota; another cleanup
rejects without reclose or replay. This remains controlled glue, not device I/O.
Three resident input controls require owned getter capture, ignored external
traversal and denied call/release reentry before marshalling into the Lib slab.

Local Chrome, Firefox and WebKit were exercised through Playwright CLI. Actions adds separate
Chrome/Firefox/WebKit cells and requires them alongside six Native desktop
cells. Receipts include actual user agent; source authority is the exact run
SHA. Browsers are installed by pinned CLI, their live revisions are reported
by receipts, not assumed identical to local Chrome. A WebKit/phone emulation
PASS would not qualify real iOS/no-JIT devices. Mobile, generic typed async
SDK, Native failed-close recovery, performance and immutable Host release
remain separate delivery gates.
