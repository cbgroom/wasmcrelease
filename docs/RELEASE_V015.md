# WAsmC v0.0.15 Agent-learning release

v0.0.15 is a source-free guidance and release-control update. It reuses the
v0.0.14 compiler, Runtime, SDK, Host and Lib bytes; it does not claim a new
compiler feature or publish private compiler source.

The release closes three defects found by the v0.0.14 post-release Pi cohort:

- cold-start release orientation now uses the validated compact
  `agent-release-orientation.json` instead of forcing an Agent to read the full
  release artifact inventory;
- Base64 selection uses the exact carried-forward `v014` catalog plus complete
  catalog, WIT and artifact digests, rather than the historical default `v009`
  resolver route;
- the live Pi runner rejects unknown or malformed reported SHA-256 values and
  unknown WAsmC identity tokens in cases with exact answer contracts, in
  addition to independent white-box review.

## Pre-release qualification

The final suffix-free prod state must first exist as an unpushed local rehearsal
commit in an isolated linked worktree. `scripts/pi-pre-release-gate-v1.mjs`
validates that exact commit and tree, all candidate product bytes, and the final
release/channel view before running the six frozen cases with Pi and both
cost-controlled model routes. The exact rehearsal commit may be tagged and
pushed only after structural and independent white-box first-pass acceptance.

The privacy-safe qualification receipt is committed after the immutable tag so
it cannot alter the tree that it attests. Any change between rehearsal and tag
invalidates the qualification and requires the complete pair to run again.
