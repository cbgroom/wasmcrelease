# Ordinary endpoint retirement ownership

File/TCP integration adapters retain the backend reference until close
acknowledgement. During close, another release or business operation rejects
busy. A failed close keeps the endpoint stopped: no read/write/sync may follow.
Only an explicit Host release may attempt close again. Successful acknowledged
close clears the backend reference; subsequent release rejects stale.

This fixes lost owner references, not arbitrary OS close recovery. The Host
still owns the endpoint object and must retain it after failure. Do not discard
it, manufacture a close acknowledgement or replay reads/writes. TCP's
`destroyed=true` alone is not acknowledgement; its actual close event is awaited.
Never-settling close needs outer isolation/supervision, not a forced free.

```sh
node host/file-io/retirement-test.mjs
bun host/file-io/retirement-test.mjs
deno run host/file-io/retirement-test.mjs
```

Three injected controls (synchronous/asynchronous File close failure and TCP
destroy failure) prove reference retention, busy denial, terminal business-I/O
denial and explicit retry with acknowledgement. No filesystem/network/env
permission is needed. These are actual adapter lifecycle tests with controlled
backends, **not induced OS close faults or Native failed-close qualification**.
The ordinary real file/TCP/App/Lib regressions remain required separately.

Whole-driver error propagation/quarantine remains distinct: an endpoint-level
retention fix does not prove every helper/supervisor retains all failed cleanup
owners or pending window pins. The supervised TCP failed-stop fence continues
to own that narrower qualified path; generic failed-retirement registry/typed
async SDK closure remains pending. Native File drop cannot be represented as
verified failed-close parity by these JS controls.
