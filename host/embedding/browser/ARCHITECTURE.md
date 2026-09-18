# Browser embedding

Browser execution is a pure-environment Host embedding.

Web APIs implement selected canonical drivers/resources, for example:

- OPFS / selected files -> storage providers
- Fetch / WebSocket / WebTransport -> network providers
- Web Crypto -> random/crypto providers
- Web Audio -> audio providers
- MediaDevices -> camera/audio providers
- Canvas/WebGPU -> display/accelerator providers

Unavailable native capabilities remain unavailable; the browser does not introduce browser-specific guest-visible Host APIs.
