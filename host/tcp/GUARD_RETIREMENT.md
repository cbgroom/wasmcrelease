# Unknown internal guard retirement

The mutable TCP supervisor retains owners when guard operation/window release
throws or fails to return the expected zero acknowledgement. The old drivers
reproduced returning an ordinary error while the supervisor deleted the owner.

`TcpGuardRetirementFailure` is Host-private, not a Guest ABI. It preserves the
primary read/write observation and remaining tickets. The endpoint has already
acknowledged retirement; never close it again or replay I/O to repair a guard.
Internal release may have failed before or after mutation. Even zero diagnostic
counts do not prove the registry is safe. The quarantined owner still counts
toward quota and denies endpoint reuse. `retireQuarantine` rejects unsupported
for this reason: isolate/replace the containing Host session externally.

```
node host/tcp/guard-retirement-test.mjs
bun host/tcp/guard-retirement-test.mjs
deno run host/tcp/guard-retirement-test.mjs
```

Twelve controlled internal faults cover read/write release before mutation,
after mutation and missing acknowledgement, for operation and window. Counters
prove one I/O/one acknowledged close, no stop/replay, bounded retained owner and
preserved primary observation. Fault hooks exist only in this isolated test
process, are restored in finally, and are not Guest-controlled extension points.
Whole-process teardown supplies test isolation; it is not successful SDK recovery.
Ordinary failed-stop/driver-retirement recovery and40000-cycle lifetime remain
separate mandatory regressions. Arbitrary registry/revoke corruption, Native
faults, never-settling containment and immutable SDK release remain unqualified.
