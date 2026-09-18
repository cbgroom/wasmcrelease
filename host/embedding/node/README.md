# Node embedding

Node is an execution environment, not a Host platform or ABI.

The canonical Host contract/runtime/drivers remain authoritative. A Node embedding may:

1. bridge to the native Host runtime on Linux/macOS/Windows; or
2. provide selected drivers through Node APIs for a source-free/pure-JS profile.

Node-specific objects must never become guest-visible Resource identities.
