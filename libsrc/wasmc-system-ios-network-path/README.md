# iOS network-path provider

This candidate maps `wasmc:system-network-path@0.0.1` to `NWPathMonitor`
without extending the fixed Host. It exposes system path status, active
interface kinds, expensive/constrained policy and IPv4/IPv6/DNS capability so
upper Libs can make reconnect and transfer decisions.

One satisfied Simulator snapshot does not qualify a path transition, Wi-Fi to
cellular handoff, offline recovery, captive portal reachability or Internet
connectivity. `NWPath.status == satisfied` means the OS has a usable path; it
does not prove a particular server is reachable.
