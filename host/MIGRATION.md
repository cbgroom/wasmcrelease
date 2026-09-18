# Host canonical tree

The public Host has one canonical source tree. Legacy top-level Host layouts are not supported.

| Former path | Canonical path |
| --- | --- |
| `host/v0/` | `host/contract/v0/` |
| `host/completion/` | `host/runtime/completion/` |
| `host/file-io/` | `host/drivers/file/` |
| `host/tcp/` | `host/drivers/tcp/` |
| `host/udp/` | `host/drivers/udp/` |
| `host/corelib-io/` | `host/core/io/` |
| `host/lib-e2e/` | `host/tests/e2e/` |
| `host/browser/` | `host/sdk/browser/` |

Rules:

1. new Host code lands only in the canonical tree;
2. no compatibility aliases or duplicate Host APIs are kept;
3. `contract/` is the single guest-visible ABI authority;
4. platform-specific implementation belongs only under `platform/`;
5. capability contracts belong under `drivers/`;
6. historical admission/evidence may retain old path strings as historical facts.
