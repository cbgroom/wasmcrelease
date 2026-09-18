# Host migration map

The existing public Host tree is retained while the canonical layout is
introduced. Migration is incremental and behavior-preserving.

| Existing path | Canonical destination | Status |
| --- | --- | --- |
| `host/v0/` | `host/contract/` + examples/tests | compatibility authority retained |
| `host/completion/` | `host/runtime/` + `host/core/lifecycle/` | planned |
| `host/file-io/` | `host/drivers/file/` + `host/platform/*/file` | planned |
| `host/tcp/` | `host/drivers/tcp/` + `host/platform/*/network` | planned |
| `host/udp/` | `host/drivers/udp/` + `host/platform/*/network` | planned |
| `host/corelib-io/` | `host/core/` + examples/tests | planned |
| `host/lib-e2e/` | `host/examples/` + `host/tests/` | planned |
| admission Host receipts | `host/qualification/` projection | planned |

Rules:

1. no mass rename;
2. old CI paths stay valid until the replacement path has equivalent evidence;
3. no second Host ABI is created during migration;
4. new platform-specific code lands under `host/platform/<platform>/`;
5. new capability contracts land under `host/drivers/<capability>/`.
