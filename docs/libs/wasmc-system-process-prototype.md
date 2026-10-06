# Current implementation: wasmc-system-process-prototype

Source authority: `libspec/wasmc-system-process-prototype/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# System process and shell prototype Lib

Unreleased public-source Lib prototype. WIT owns both the preferred typed
`executable + argv` process semantic and an explicit shell-script semantic. The
exact Lib adapter lowers bounded requests to the surrounding Node environment;
the fixed Host executor has no process or shell API and remains byte-identical.

`processes.run` never enables shell parsing. `shells.run` selects one named OS
shell without relying on the user's login-shell configuration:

- Linux and macOS: `/bin/sh -c`;
- Windows: `%ComSpec% /d /s /c` or Windows PowerShell with `-NoProfile`.

Both paths return stdout, stderr, exit status, signal/termination state and
elapsed time, accept bounded stdin/cwd/environment options, and enforce timeout
and combined-output limits. This Node provider does not imply Android or iOS
support. Android needs an app-sandbox native provider and real app-UID
qualification. Sandboxed iOS applications have no general child-process or OS
shell facility; an iOS provider can only expose a separately named in-process
command runtime whose commands are linked into the App.

This package is not admitted, cataloged or released.
