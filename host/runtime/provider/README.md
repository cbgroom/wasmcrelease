# Retained provider selection

This directory retains v0.0.15 provider-selection evidence while the target
architecture moves domain selection into exact Lib graphs.

A provider may be backed by:

- a native platform adapter (`platform/*`), or
- an execution environment (`embedding/*`).

In the successor boundary, the Host selects only a domain-neutral physical
executor. WIT and the matching Lib-owned descriptor define the domain.

Hot-path dispatch remains Resource + Window + Operation + Completion oriented.
Adding a domain-specific provider here is forbidden.
